-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- to create the blogs table used by blogs.html / blog.html / admin.html.

create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content text not null,
  keyword text,
  image_url text,
  image_credit_name text,
  image_credit_url text,
  published boolean not null default true
);

alter table public.blogs enable row level security;

-- Public visitors (anon key) can only read published posts.
create policy "Public can read published blogs"
  on public.blogs
  for select
  to anon
  using (published = true);

-- Logged-in admin (Supabase Auth user, used by admin.html) has full access.
create policy "Authenticated can read all blogs"
  on public.blogs
  for select
  to authenticated
  using (true);

create policy "Authenticated can insert blogs"
  on public.blogs
  for insert
  to authenticated
  with check (true);

create policy "Authenticated can update blogs"
  on public.blogs
  for update
  to authenticated
  using (true);

create policy "Authenticated can delete blogs"
  on public.blogs
  for delete
  to authenticated
  using (true);

-- Note: the automated GitHub Actions script inserts posts using the
-- service_role key, which bypasses RLS entirely (full access by design) --
-- it does not need a policy of its own.
