// Swaps the cover image on an existing post, triggered by the "Regenerate
// Image" button in admin.html's review modal — for when the auto-picked
// photo doesn't actually fit the article.

import {
  getDb, fetchUnsplashImage, checkImageRelevance, getUsedImageUrls, getAdminAuth,
} from '../../scripts/blog-generator-core.mjs';

const ADMIN_EMAILS = ['kanunga.lavesh@gmail.com'];

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let slug, imageQuery, idToken;
  try {
    ({ slug, imageQuery, idToken } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!slug || !imageQuery) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing slug or imageQuery.' }) };
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
    const db = getDb();
    const docRef = db.collection('blogs').doc(slug);
    const doc = await docRef.get();
    if (!doc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Post not found.' }) };
    }
    const post = doc.data();

    const usedUrls = await getUsedImageUrls();
    if (post.imageUrl) usedUrls.push(post.imageUrl); // never pick the same image again
    const image = await fetchUnsplashImage(imageQuery, usedUrls);
    if (!image) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No alternative image found for that query.' }) };
    }
    const imageRelevance = await checkImageRelevance(image.url, post.title, post.excerpt);

    await docRef.update({
      imageUrl: image.url,
      imageCreditName: image.creditName,
      imageCreditUrl: image.creditUrl,
      imageRelevance: imageRelevance || null,
    });

    return { statusCode: 200, body: JSON.stringify({ success: true, image, imageRelevance }) };
  } catch (err) {
    console.error('regenerate-image failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Regeneration failed.' }) };
  }
};
