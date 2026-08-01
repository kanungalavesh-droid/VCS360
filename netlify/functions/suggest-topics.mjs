// Powers the "Hot Topics & Keywords" panel in admin.html — returns live
// trending finance headlines (from RSS, fetched server-side since browsers
// block cross-origin RSS requests) plus a curated list of high-intent
// search phrases for VCS's services. Auth-gated like the other tools.

import { fetchTrendingHeadlines, HIGH_INTENT_KEYWORDS, getAdminAuth } from '../../scripts/blog-generator-core.mjs';

const ADMIN_EMAILS = ['kanunga.lavesh@gmail.com'];

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let idToken;
  try {
    ({ idToken } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!idToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing auth token.' }) };
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired login. Please sign in again.' }) };
  }
  if (!ADMIN_EMAILS.includes(decoded.email)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized.' }) };
  }

  try {
    const trending = await fetchTrendingHeadlines();
    const keywords = pickRandom(HIGH_INTENT_KEYWORDS, 8);
    return {
      statusCode: 200,
      body: JSON.stringify({
        trending: pickRandom(trending, 8),
        keywords,
      }),
    };
  } catch (err) {
    console.error('suggest-topics failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Could not load suggestions.' }) };
  }
};
