-- ============================================================
-- HELIX STAGE — Migration v3
-- ביקורות ודירוגים + גלריית סקרינשוטים + Build in Public
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1) גלריית סקרינשוטים למוצר
alter table public.products
  add column if not exists screenshots text[] not null default '{}';

-- 2) ביקורות ודירוגים
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  pros text,
  cons text,
  body text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);

alter table public.reviews enable row level security;

do $$ begin
  create policy "reviews are public" on public.reviews for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users insert own reviews" on public.reviews for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update own reviews" on public.reviews for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own reviews" on public.reviews for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 3) Build in Public — פוסטים של יזמים
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  type text not null default 'build_in_public' check (type in ('build_in_public', 'show_il')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

do $$ begin
  create policy "posts are public" on public.posts for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users insert own posts" on public.posts for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own posts" on public.posts for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- 4) אימות: מי שיש לו LinkedIn בפרופיל מסומן כמאומת (לתג "מאומת")
update public.profiles set is_verified = true
where linkedin_url is not null and linkedin_url <> '' and is_verified = false;
