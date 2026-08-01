// Scheduled blog generator: pulls a real trending finance headline from RSS,
// asks Gemini to write a post about it, generates an original cover image
// (falling back to a unique Unsplash photo if that fails), checks stock
// photos against the topic with Gemini vision, runs a basic SEO checklist,
// and saves it to Firestore as a DRAFT (published: false) for manual review
// in admin.html. Runs in GitHub Actions (see .github/workflows/generate-blog.yml).

import {
  fetchTrendingHeadline, generatePost, getBlogImage, checkImageRelevance,
  computeSeoChecks, getUsedImageUrls, insertBlog, slugify,
} from './blog-generator-core.mjs';

async function main() {
  console.log('Fetching trending headline...');
  const headline = await fetchTrendingHeadline();
  console.log('Topic:', headline);

  console.log('Generating post with Gemini...');
  const post = await generatePost(headline);

  console.log('Getting a cover image for:', post.image_query);
  const usedUrls = await getUsedImageUrls();
  const slug = slugify(post.slug || post.title);
  const image = await getBlogImage({ query: post.image_query, title: post.title, slug, excludeUrls: usedUrls });
  console.log('Image source:', image?.source || 'none');

  // Gemini-generated images are already on-topic by construction — only
  // spend a relevance check on stock photos pulled from Unsplash.
  const imageRelevance = (image && image.source === 'unsplash')
    ? await checkImageRelevance(image.url, post.title, post.excerpt)
    : null;

  const seoChecks = computeSeoChecks(post, headline);

  console.log('Saving to Firestore as draft...');
  const result = await insertBlog({ post, image, topic: headline, published: false, seoChecks, imageRelevance });

  console.log('Blog post created (draft):', result.title, '(' + result.slug + ')');
}

main().catch(err => {
  console.error('Blog generation failed:', err);
  process.exit(1);
});
