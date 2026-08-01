// On-demand blog generator, triggered from the "Generate New Post" panel in
// admin.html. Runs server-side so the Gemini/Unsplash/Firebase secrets never
// reach the browser — the client only sends the topic plus their Firebase
// ID token, which we verify here before doing anything.

import {
  generatePost, fetchUnsplashImage, checkImageRelevance, computeSeoChecks,
  getUsedImageUrls, insertBlog, getAdminAuth,
} from '../../scripts/blog-generator-core.mjs';

// Keep in sync with the admin allowlist in firestore.rules.
const ADMIN_EMAILS = ['kanunga.lavesh@gmail.com'];

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let topic, idToken;
  try {
    ({ topic, idToken } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please provide a topic.' }) };
  }
  if (!idToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing auth token.' }) };
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch (err) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired login. Please sign in again.' }) };
  }

  if (!ADMIN_EMAILS.includes(decoded.email)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized.' }) };
  }

  const cleanTopic = topic.trim();

  try {
    const post = await generatePost(cleanTopic);

    const usedUrls = await getUsedImageUrls();
    const image = await fetchUnsplashImage(post.image_query, usedUrls);
    const imageRelevance = image ? await checkImageRelevance(image.url, post.title, post.excerpt) : null;
    const seoChecks = computeSeoChecks(post, cleanTopic);

    const result = await insertBlog({ post, image, topic: cleanTopic, published: false, seoChecks, imageRelevance });
    return { statusCode: 200, body: JSON.stringify({ success: true, ...result, seoChecks, imageRelevance }) };
  } catch (err) {
    console.error('Manual blog generation failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Generation failed.' }) };
  }
};
