// Scheduled blog generator: pulls a real trending finance headline from RSS,
// asks Gemini to write a post about it, fetches a matching Unsplash photo,
// and saves it to Firestore as a DRAFT (published: false) for manual review
// in admin.html. Runs in GitHub Actions (see .github/workflows/generate-blog.yml).

import { fetchTrendingHeadline, generatePost, fetchUnsplashImage, insertBlog } from './blog-generator-core.mjs';

async function main() {
  console.log('Fetching trending headline...');
  const headline = await fetchTrendingHeadline();
  console.log('Topic:', headline);

  console.log('Generating post with Gemini...');
  const post = await generatePost(headline);

  console.log('Fetching image for:', post.image_query);
  const image = await fetchUnsplashImage(post.image_query);

  console.log('Saving to Firestore as draft...');
  const result = await insertBlog(post, image, headline, false);

  console.log('Blog post created (draft):', result.title, '(' + result.slug + ')');
}

main().catch(err => {
  console.error('Blog generation failed:', err);
  process.exit(1);
});
