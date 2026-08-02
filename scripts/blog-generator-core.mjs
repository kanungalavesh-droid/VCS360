// Shared logic used by the scheduled generator (scripts/generate-blog.mjs,
// run via GitHub Actions) and the on-demand generators/tools in
// netlify/functions/*.mjs (triggered from admin.html). Keeping this in one
// place means every entrypoint stays in sync automatically.

import admin from 'firebase-admin';

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-flash-latest',
  UNSPLASH_ACCESS_KEY,
  FIREBASE_SERVICE_ACCOUNT,
} = process.env;

export const AUTHOR_NAME = 'VCS Advisory Team';

function getApp() {
  if (!FIREBASE_SERVICE_ACCOUNT) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env var.');
  // Reuse the default app across warm invocations (Netlify/GitHub Actions
  // may re-enter this module without a fresh process), avoid re-init errors.
  return admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
}

export function getDb() {
  return getApp().firestore();
}

export function getAdminAuth() {
  return getApp().auth();
}

export const RSS_FEEDS = [
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

// High commercial-intent search phrases for VCS's services — the kind of
// thing someone types right before they need to hire a consultant. Shown in
// admin.html as ready-made topic suggestions alongside live trending news.
export const HIGH_INTENT_KEYWORDS = [
  'How to file ITR online step by step guide',
  'GST registration process for new business in India',
  'Best tax saving investment options under 80C',
  'Personal loan vs business loan interest rates compared',
  'How to get a business loan with no collateral',
  'Term insurance vs whole life insurance which is better',
  'Virtual CFO services cost and benefits for startups',
  'Mutual funds vs fixed deposit returns comparison',
  'GST late filing penalty and how to avoid it',
  'How to save capital gains tax on property sale',
  'Documents required for MSME loan application',
  'Income tax slab rates for salaried employees',
  'How to register a private limited company in India',
  'Best investment options for retirement planning',
  'GST input tax credit rules explained simply',
];

function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

// Returns every RSS headline that matches our service keywords (deduped),
// for use as topic suggestions. Falls back to the curated list if feeds fail.
export async function fetchTrendingHeadlines() {
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
        if (SERVICE_KEYWORDS.some(kw => lower.includes(kw)) && !matches.includes(title)) {
          matches.push(title);
        }
      }
    } catch (err) {
      console.warn(`RSS feed failed (${feedUrl}): ${err.message}`);
    }
  }
  return matches;
}

export async function fetchTrendingHeadline() {
  const matches = await fetchTrendingHeadlines();
  if (matches.length > 0) {
    return matches[Math.floor(Math.random() * matches.length)];
  }
  console.warn('No matching RSS headlines found, using fallback topic list.');
  return FALLBACK_TOPICS[Math.floor(Math.random() * FALLBACK_TOPICS.length)];
}

export async function generatePost(topic) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY env var.');

  const systemInstruction = `You are a content writer for Vardhman Consultancy Services (VCS), an Indian financial consultancy based in Vapi, Gujarat, serving clients across India. VCS offers: Taxation & ITR filing, GST & Compliance, Business Loans & Finance, Investments & Wealth Management, Insurance Advisory, Business Advisory, and Virtual CFO services. Write clear, accurate, SEO-friendly blog posts in simple English for individuals and small business owners. You may naturally mention relevant VCS services where genuinely relevant, without being overly promotional. Output must be valid JSON matching the given schema only — no extra commentary.`;

  const userPrompt = `Write a blog post about: "${topic}". Make it educational and practical for Indian readers.
Requirements:
- title: compelling, under 70 characters, and naturally include the main keyword from the topic
- slug: lowercase-hyphenated, no special characters, under 60 characters
- excerpt: 1-2 sentences, under 160 characters (this is used as the meta description)
- content: 600-900 words as clean HTML using only <h2>, <h3>, <p>, <ul>, <li> tags (no markdown, no <html>/<body> wrapper), with at least two <h2> subheadings
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

export function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function getUsedImageUrls() {
  try {
    const snapshot = await getDb().collection('blogs').get();
    return snapshot.docs.map(d => d.data().imageUrl).filter(Boolean);
  } catch (err) {
    console.warn('Could not fetch used image URLs: ' + err.message);
    return [];
  }
}

// Fetches multiple candidate photos and skips any URL already used on the
// site, so back-to-back posts on similar topics don't end up with the same
// picture.
export async function fetchUnsplashImage(query, excludeUrls = []) {
  if (!UNSPLASH_ACCESS_KEY) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const results = json.results || [];
    if (results.length === 0) return null;
    const photo = results.find(p => !excludeUrls.includes(p.urls.regular)) || results[0];
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

// Image pipeline: Unsplash only (Gemini's image model needs a paid Google
// Cloud plan — confirmed via a 429 "limit: 0" free-tier response — and a
// free third-party generator wasn't worth the added complexity here).
export async function getBlogImage({ query, excludeUrls = [] }) {
  const unsplash = await fetchUnsplashImage(query, excludeUrls);
  return unsplash ? { ...unsplash, source: 'unsplash' } : null;
}

// Asks Gemini's vision model whether the chosen photo actually matches the
// post. Best-effort: any failure just returns null (treated as "unchecked"
// by the UI) rather than blocking generation.
export async function checkImageRelevance(imageUrl, title, excerpt) {
  if (!imageUrl || !GEMINI_API_KEY) return null;
  try {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Does this photo visually make sense as the cover image for a blog post titled "${title}" (summary: "${excerpt}")? Be reasonably lenient — it just needs to be thematically relevant, not literal. Answer as JSON only.` },
          { inlineData: { mimeType: contentType, data: base64 } },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            aligned: { type: 'BOOLEAN' },
            note: { type: 'STRING' },
          },
          required: ['aligned', 'note'],
        },
      },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    console.warn('Image relevance check failed: ' + err.message);
    return null;
  }
}

// Lightweight on-page SEO checklist shown in admin.html — not a substitute
// for real SEO tooling, but catches the basics before a post goes live.
export function computeSeoChecks(post, topic) {
  const wordCount = (post.content || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const titleLen = (post.title || '').length;
  const excerptLen = (post.excerpt || '').length;
  const hasHeadings = /<h2/i.test(post.content || '');
  const topicWords = (topic || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const titleLower = (post.title || '').toLowerCase();
  const keywordInTitle = topicWords.some(w => titleLower.includes(w));

  return [
    { label: 'Title length', pass: titleLen >= 20 && titleLen <= 70, detail: `${titleLen} characters (aim for 30-70)` },
    { label: 'Meta description length', pass: excerptLen >= 50 && excerptLen <= 165, detail: `${excerptLen} characters (aim for 70-160)` },
    { label: 'Content length', pass: wordCount >= 500, detail: `${wordCount} words (aim for 500+)` },
    { label: 'Has subheadings for structure', pass: hasHeadings, detail: hasHeadings ? 'H2 tags found' : 'No H2 subheadings found' },
    { label: 'Keyword present in title', pass: keywordInTitle, detail: keywordInTitle ? 'Yes' : 'Main keyword not found in title' },
  ];
}

export async function insertBlog({ post, image, topic, published, seoChecks, imageRelevance }) {
  const db = getDb();
  const baseSlug = slugify(post.slug || post.title);
  const baseRef = db.collection('blogs').doc(baseSlug);
  const existing = await baseRef.get();
  const finalSlug = existing.exists ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  await db.collection('blogs').doc(finalSlug).set({
    title: post.title,
    excerpt: post.excerpt,
    content: post.content,
    keyword: topic.slice(0, 200),
    imageUrl: image?.url || null,
    imageCreditName: image?.creditName || null,
    imageCreditUrl: image?.creditUrl || null,
    imageSource: image?.source || null,
    imageRelevance: imageRelevance || null,
    seoChecks: seoChecks || null,
    author: AUTHOR_NAME,
    published: !!published,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { slug: finalSlug, title: post.title };
}
