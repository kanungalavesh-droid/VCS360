# Deploying vcs360.com

This repo is now a git repo with one commit. Everything below is done from
your browser/GitHub/Netlify/GoDaddy accounts — I can't log into these for you.

## 1. Push to GitHub

```bash
# create a new empty repo at github.com/new (no README/license), then:
git remote add origin https://github.com/<your-username>/vcs-website.git
git push -u origin main
```

## 2. Create the Supabase project (if not already) and table

1. In your Supabase project, open **SQL Editor -> New query**, paste the
   contents of `supabase/schema.sql`, and run it. This creates the `leads`
   table with a policy that only allows inserts (not reads) via the public key.
2. Go to **Project Settings -> API** and copy:
   - **Project URL**
   - **anon public** key (NOT the `service_role` key)
3. Open `index.html`, find these two lines near the bottom (`<script>` block):
   ```js
   const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
   and replace the placeholders with your actual values. Commit + push that change.
4. To view submitted leads later: Supabase dashboard -> **Table Editor -> leads**.

## 3. Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) -> **Add new site -> Import an existing project**.
2. Connect GitHub, pick the `vcs-website` repo.
3. Build settings: leave build command empty, publish directory `.` (already set in `netlify.toml`).
4. Deploy. You'll get a temporary URL like `random-name.netlify.app` — confirm the site loads and the form works before moving on.

## 4. Point vcs360.com (GoDaddy) at Netlify

In Netlify: **Site settings -> Domain management -> Add a domain** -> enter `vcs360.com`.

Netlify will show you DNS records to add. Two options:

**Option A — keep GoDaddy as DNS host (simpler, recommended):**
In GoDaddy DNS management for vcs360.com, add:
| Type  | Name | Value                  |
|-------|------|------------------------|
| A     | @    | `75.2.60.5`            |
| CNAME | www  | `<your-site>.netlify.app` |

(Netlify's dashboard will confirm the exact A record IP for your account — use what it shows if it differs.)

**Option B — delegate DNS to Netlify (more features, e.g. easier redirects):**
In GoDaddy, change the domain's nameservers to Netlify's (shown in Netlify's domain setup screen), then manage all DNS from Netlify.

Either way, allow up to a few hours for DNS + free auto-provisioned HTTPS (Let's Encrypt) to activate. Netlify will show a green "HTTPS enabled" status when done.

## 5. Post-launch check

- Load `https://vcs360.com` and submit a test lead through the form.
- Confirm the row appears in Supabase **Table Editor -> leads**.
- Update the placeholder WhatsApp number (`919999999999`) in `index.html` to your real business number if it hasn't been already.
