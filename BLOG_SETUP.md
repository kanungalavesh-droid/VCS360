# Setting up the automated blog system

This adds automated finance blog posts to the site, generated 3x/week
(Mon/Wed/Fri) using a real trending headline + Gemini (free tier) + a free
Unsplash photo, saved into a new Supabase `blogs` table.

New files: `blogs.html` (listing), `blog.html` (single post), `admin.html`
(manage posts), `scripts/generate-blog.mjs` (the generator),
`.github/workflows/generate-blog.yml` (the schedule), `supabase/blogs_schema.sql`.

## 1. Create the blogs table in Supabase

SQL Editor → New query → paste the contents of `supabase/blogs_schema.sql` → Run.

## 2. Create your admin login (Supabase Auth)

`admin.html` uses Supabase's built-in auth so only you can manage posts.

1. Supabase dashboard → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email + a password. Toggle **Auto Confirm User** on (so you don't need to click an email link).
3. This is the login you'll use on `admin.html`.

## 3. Get a free Gemini API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Sign in with a Google account → **Create API key**.
3. Copy the key (starts with `AIza...`). This uses the free tier — fine for 3 posts/week.

## 4. Get a free Unsplash API key (for blog photos)

1. Go to [unsplash.com/developers](https://unsplash.com/developers) → **Register as a developer** → **New Application**.
2. Accept the terms, name it something like "VCS Blog".
3. Copy the **Access Key** from the app's page.

## 5. Upload the new files to GitHub

Since folder drag-and-drop caused issues before, use **"Create new file"** instead —
it lets you type a full path (e.g. `scripts/generate-blog.mjs`) and GitHub creates
the folders automatically, so nothing gets flattened.

For each file below: on your `VCS360` repo page → **Add file → Create new file** →
type the exact path as the filename → paste the file's contents → commit.

- `blogs.html`
- `blog.html`
- `admin.html`
- `scripts/generate-blog.mjs`
- `.github/workflows/generate-blog.yml`
- `supabase/blogs_schema.sql` (optional, for reference — you already ran it in step 1)

Copy each file's contents from this project folder on your Mac (open in any text
editor, e.g. TextEdit, VS Code, or ask me to print any file's contents again).

## 6. Fill in the Supabase URL/key placeholders

`blogs.html`, `blog.html`, and `admin.html` each have the same two placeholder
lines near the bottom as `index.html` does:
```js
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```
Edit all three files on GitHub and replace both lines with the same values
you already used in `index.html` (your Supabase project URL and anon key).

## 7. Add the "Insights" nav link to index.html

Open `index.html` on GitHub → edit → find this line (in the mobile menu section):
```html
<a href="#testimonials" onclick="closeMobile()">Testimonials</a>
<a href="#contact" onclick="closeMobile()">Contact</a>
```
Change it to:
```html
<a href="#testimonials" onclick="closeMobile()">Testimonials</a>
<a href="blogs.html" onclick="closeMobile()">Insights</a>
<a href="#contact" onclick="closeMobile()">Contact</a>
```
Then find this line (in the desktop nav, a few lines below):
```html
<li><a href="#testimonials">Testimonials</a></li>
<li><a href="#contact">Contact</a></li>
```
Change it to:
```html
<li><a href="#testimonials">Testimonials</a></li>
<li><a href="blogs.html">Insights</a></li>
<li><a href="#contact">Contact</a></li>
```
Commit.

## 8. Add the secrets to GitHub Actions

Your `VCS360` repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add these four, one at a time:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | the key from step 3 |
| `UNSPLASH_ACCESS_KEY` | the key from step 4 |
| `SUPABASE_URL` | your Supabase project URL (same as in index.html) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **secret key** (`sb_secret_...` or the legacy `service_role` key) — **never** put this one in any HTML file, it's only safe inside GitHub secrets |

## 9. Test it manually

1. Your repo → **Actions** tab → click **Generate Blog Post** (left sidebar) → **Run workflow** → **Run workflow** (button).
2. Wait ~30-60 seconds, refresh — it should show a green checkmark.
3. If it fails (red X), click into it to see the error log and send it to me.
4. Once it succeeds, visit `blogs.html` on your live site — the new post should appear.
5. Log into `admin.html` with the email/password from step 2 to see it listed there too.

After that, it runs automatically every Monday, Wednesday, and Friday — no further action needed.
