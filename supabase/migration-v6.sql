-- ============================================================
-- HELIX STAGE — Migration v6
-- Command Center: מעקב צפיות + ייחוס, לוח חיבורים, קהילת בטא + דף נחיתה
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1) אנליטיקס: אירועי צפייה / המרה
create table if not exists public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  event text not null default 'view',
  source text,
  surface text,
  session_hash text,
  created_at timestamptz not null default now()
);
create index if not exists product_views_idx on public.product_views (product_id, created_at desc);

alter table public.product_views enable row level security;
do $$ begin
  create policy "anyone inserts views" on public.product_views for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "owners read own views" on public.product_views for select using (
    exists (select 1 from public.products p where p.id = product_id and p.owner_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

-- 2) לוח חיבורים
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('hiring', 'open_to_work', 'collab')),
  product_id uuid references public.products(id) on delete set null,
  role_title text,
  body text not null,
  contact_email text,
  created_at timestamptz not null default now()
);
create index if not exists listings_created_idx on public.listings (created_at desc);

alter table public.listings enable row level security;
do $$ begin
  create policy "listings are public" on public.listings for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users insert own listings" on public.listings for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own listings" on public.listings for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 3) קהילת בטא + דף נחיתה (עמודות על products)
alter table public.products
  add column if not exists beta_enabled boolean not null default false,
  add column if not exists beta_whatsapp_url text,
  add column if not exists beta_note text,
  add column if not exists landing_enabled boolean not null default false,
  add column if not exists landing_headline text,
  add column if not exists landing_subheadline text,
  add column if not exists landing_cta text;
