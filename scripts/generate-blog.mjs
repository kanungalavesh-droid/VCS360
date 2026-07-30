// Automated blog generator: pulls a real trending finance headline from RSS,
// asks Gemini to write a post about it, fetches a matching Unsplash photo,
// and inserts the result into the Firestore `blogs` collection.
// Runs in GitHub Actions (see .github/workflows/generate-blog.yml).

import admin from 'firebase-admin';

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-2.5-flash',
  UNSPLASH_ACCESS_KEY,
  FIREBASE_SERVICE_ACCOUNT,
} = process.env;

if (!GEMINI_API_KEY || !FIREBASE_SERVICE_ACCOUNT) {
  console.error('Missing required environment variables (GEMINI_API_KEY, FIREBASE_SERVICE_ACCOUNT).');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)),
});
const db = admin.firestore();

const RSS_FEEDS = [
  'https://www.moneycontrol.com/rss/business.xml',
  'https://www.moneycontrol.com/rss/personalfinance.xml',
  'https://www.livemint.com/rss/money',
];

const SERVICE_KEYWORDS = [
  'tax', 'gst', 'itr', 'income tax', 'loan', 'emi', 'invest', 'mutual fund',
  'insurance', 'startup', 'msme', 'compliance', 'rbi', 'budget', 'bank',
  'credit', 'ipo', 'stock market', 'gold', 'real estate', 'property', 'finance',
];

const FALLBACK_TOPICS = [
  'Income Tax Return filing deadlines and common mistakes to avoid',
  'GST compliance checklist every small business should follow',
  'How to choose the right business loan for your company',
  'Mutual funds vs fixed deposits: where should you invest this year',
  'Term insurance vs whole life insurance: which one do you actually need',
  'Virtual CFO services: when does a growing business need one',
  'How RBI repo rate changes affect your home loan EMI',
];

function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

async function fetchTrendingHeadline() {
  const matches = [];
  for (const feedUrl of RSS_FEEDS) {
    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const item of items) {
        const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
        if (!titleMatch) continue;
        const title = decodeEntities(titleMatch[1]);
        const lower = title.toLowerCase();
        if (SERVICE_KEYWORDS.some(kw => lower.includes(kw))) {
          matches.push(title);
        }
      }
    } catch (err) {
      console.warn(`RSS feed failed (${feedUrl}): ${err.message}`);
    }
  }

  if (matches.length > 0) {
    return matches[Math.floor(Math.random() * matches.length)];
  }
  console.warn('No matching RSS headlines found, using fallback topic list.');
  return FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
}

async function generatePost(headline) {
  const systemInstruction = `You are a content writer for Vardhman Consultancy Services (VCS), an Indian financial consultancy based in Vapi, Gujarat, serving clients across India. VCS offers: Taxation & ITR filing, GST & Compliance, Business Loans & Finance, Investments & Wealth Management, Insurance Advisory, Business Advisory, and Virtual CFO services. Write clear, accurate, SEO-friendly blog posts in simple English for individuals and small business owners. You may naturally mention relevant VCS services where genuinely relevant, without being overly promotional. Output must be valid JSON matching the given schema only — no extra commentary.`;

  const userPrompt = `Write a blog post inspired by this current finance news headline: "${headline}". Make it educational and practical for Indian readers.
Requirements:
- title: compelling, under 70 characters
- slug: lowercase-hyphenated, no special characters, under 60 characters
- excerpt: 1-2 sentences, under 160 characters
- content: 600-900 words as clean HTML using only <h2>, <h3>, <p>, <ul>, <li> tags (no markdown, no <html>/<body> wrapper)
- image_query: 2-4 words describing an ideal stock photo for this topic (e.g. "tax documents calculator")`;

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          slug: { type: 'STRING' },
          excerpt: { type: 'STRING' },
          content: { type: 'STRING' },
          image_query: { type: 'STRING' },
        },
        required: ['title', 'slug', 'excerpt', 'content', 'image_query'],
      },
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content: ' + JSON.stringify(json));

  return JSON.parse(text);
}

function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function fetchUnsplashImage(query) {
  if (!UNSPLASH_ACCESS_KEY) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const photo = json.results?.[0];
    if (!photo) return null;
    return {
      url: photo.urls.regular,
      creditName: photo.user.name,
      creditUrl: `${photo.user.links.html}?utm_source=vcs360&utm_medium=referral`,
    };
  } catch (err) {
    console.warn('Unsplash fetch failed: ' + err.message);
    return null;
  }
}

async function insertBlog(post, image, headline) {
  const baseSlug = slugify(post.slug || post.title);
  const baseRef = db.collection('blogs').doc(baseSlug);
  const existing = await baseRef.get();
  const finalSlug = existing.exists ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  await db.collection('blogs').doc(finalSlug).set({
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    keyword: headline.slice(0, 200),
    imageUrl: image?.url || null,
    imageCreditName: image?.creditName || null,
    imageCreditUrl: image?.creditUrl || null,
    published: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('Blog post created:', post.title, '(' + finalSlug + ')');
}

async function main() {
  console.log('Fetching trending headline...');
  const headline = await fetchTrendingHeadline();
  console.log('Topic:', headline);

  console.log('Generating post with Gemini...');
  const post = await generatePost(headline);

  console.log('Fetching image for:', post.image_query);
  const image = await fetchUnsplashImage(post.image_query);

  console.log('Saving to Firestore...');
  await insertBlog(post, image, headline);

  console.log('Done.');
}

main().catch(err => {
  console.error('Blog generation failed:', err);
  process.exit(1);
});
