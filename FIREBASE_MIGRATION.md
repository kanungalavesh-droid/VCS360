# Migrating from Supabase to Firebase

Most of this is already done — I created the Firebase project, the Firestore
database, deployed the security rules and indexes, and registered a web app
directly from the terminal using the Firebase CLI (already logged in as
kanunga.lavesh@gmail.com). What's left needs your account/browser for things
I genuinely can't do on your behalf (payment-free but still your identity):
choosing your own admin password, and signing up for two other free services.

Project: **vcs360-website** — https://console.firebase.google.com/project/vcs360-website/overview

## 1. Enable Email/Password sign-in (for admin.html)

1. Open the [Firebase console](https://console.firebase.google.com/project/vcs360-website/authentication) → **Authentication**.
2. Click **Get started** if prompted.
3. **Sign-in method** tab → **Email/Password** → enable the first toggle → **Save**.

## 2. Create your admin login

1. Still in **Authentication** → **Users** tab → **Add user**.
2. Enter your email and a password of your choice (this is what you'll use to log into `admin.html` — keep it private, don't share it with me).

## 3. Get a free Gemini API key

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → sign in → **Create API key**.
2. Copy it (starts with `AIza...`).

## 4. Get a free Unsplash API key

1. [unsplash.com/developers](https://unsplash.com/developers) → **Register as a developer** → **New Application**.
2. Copy the **Access Key**.

## 5. Generate the service account key (for the automated GitHub Action)

1. [Firebase console](https://console.firebase.google.com/project/vcs360-website/settings/serviceaccounts/adminsdk) → **Project Settings** → **Service Accounts** tab.
2. Click **Generate new private key** → confirm → a JSON file downloads.
3. Keep this file safe and don't share its contents anywhere except the GitHub secret below — it grants full admin access to your Firestore database.

## 6. Upload the changed files to GitHub

These files are new or changed since the Supabase version. On your `VCS360`
repo, use **Add file → Create new file** (types the path, creates folders
automatically) for new files, or open + edit existing ones the same way we
did before:

**New files:**
- `firestore.rules`
- `firebase.json`
- `firestore.indexes.json`
- `package.json`

**Changed files (replace entire contents with the updated version from this project folder):**
- `index.html`
- `blogs.html`
- `blog.html`
- `admin.html`
- `scripts/generate-blog.mjs`
- `.github/workflows/generate-blog.yml`

(Ask me to print any file's contents again if you need to copy them.)

## 7. Add the GitHub Actions secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | from step 3 |
| `UNSPLASH_ACCESS_KEY` | from step 4 |
| `FIREBASE_SERVICE_ACCOUNT` | open the JSON file from step 5 in a text editor, copy its **entire contents**, paste as the secret value |

You can delete the old `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` secrets — no longer used.

## 8. Test it

1. Repo → **Actions** tab → **Generate Blog Post** → **Run workflow** → **Run workflow**.
2. Wait ~30-60s, check for a green checkmark (click in if it fails, send me the error log).
3. Visit `blogs.html` on your live site — the new post should appear.
4. Log into `admin.html` with your email/password from step 2.
5. Submit the lead form on the live site once, then check **Firestore Database** in the Firebase console → `leads` collection — your test entry should be there.

## About your old Supabase data

Your live lead form has been capturing entries in Supabase up to now. Migrating
means *new* submissions go to Firestore going forward — existing Supabase leads
won't automatically move over. If you want that historical data carried across
too, let me know and I'll help export/import it; otherwise your Supabase
project can just stay as an archive, or you can delete it once you've confirmed
Firebase is working end-to-end.
