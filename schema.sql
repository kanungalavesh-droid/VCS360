-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- to create the leads table used by the "Book Your Free Consultation" form.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text,
  city text,
  service text,
  message text
);

alter table public.leads enable row level security;

-- Anyone (using the public anon key) can submit a lead...
create policy "Anyone can insert leads"
  on public.leads
  for insert
  to anon
  with check (true);

-- ...but nobody can read/update/delete leads via the anon key.
-- View leads from the Supabase dashboard (Table Editor) using your
-- authenticated account, which bypasses RLS.
