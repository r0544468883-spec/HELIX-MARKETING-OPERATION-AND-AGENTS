-- ============================================================
-- HELIX STAGE — Database Schema
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> הדבקה -> Run
-- ============================================================

-- ---------- טבלאות ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  username text unique not null,
  avatar_url text,
  role_title text,
  company text,
  linkedin_url text,
  is_verified boolean not null default false,
  user_type text not null default 'consumer' check (user_type in ('consumer', 'maker')),
  onboarding_completed boolean not null default false,
  interests integer[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  tagline text not null,
  description text,
  logo_url text,
  website_url text,
  screenshots text[] not null default '{}',
  status text not null default 'live' check (status in ('pre_launch', 'beta', 'live')),
  created_at timestamptz not null default now()
);

create table public.launches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  launch_date date not null,
  featured boolean not null default false,
  votes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index launches_date_idx on public.launches (launch_date desc, votes_count desc);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  launch_id uuid not null references public.launches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, launch_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  launch_id uuid not null references public.launches(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.categories (
  id serial primary key,
  slug text unique not null,
  name_he text not null,
  name_en text not null
);

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id integer not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (product_id, email)
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  locale text not null default 'he',
  created_at timestamptz not null default now()
);

-- ---------- טריגר: יצירת פרופיל אוטומטית בהרשמה ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_-]', '', 'g')) || '-' || substr(md5(random()::text), 1, 4),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- טריגרים: ספירת הצבעות ותגובות ----------

create or replace function public.bump_votes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.launches set votes_count = votes_count + 1 where id = new.launch_id;
    return new;
  else
    update public.launches set votes_count = greatest(votes_count - 1, 0) where id = old.launch_id;
    return old;
  end if;
end;
$$;

create trigger on_vote_change
  after insert or delete on public.votes
  for each row execute function public.bump_votes_count();

create or replace function public.bump_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.launches set comments_count = comments_count + 1 where id = new.launch_id;
    return new;
  else
    update public.launches set comments_count = greatest(comments_count - 1, 0) where id = old.launch_id;
    return old;
  end if;
end;
$$;

create trigger on_comment_change
  after insert or delete on public.comments
  for each row execute function public.bump_comments_count();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.launches enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.categories enable row level security;
alter table public.product_categories enable row level security;
alter table public.waitlist_signups enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- profiles
create policy "profiles are public" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

-- products
create policy "products are public" on public.products for select using (true);
create policy "owners insert products" on public.products for insert with check (auth.uid() = owner_id);
create policy "owners update products" on public.products for update using (auth.uid() = owner_id);
create policy "owners delete products" on public.products for delete using (auth.uid() = owner_id);

-- launches
create policy "launches are public" on public.launches for select using (true);
create policy "owners insert launches" on public.launches for insert with check (
  exists (select 1 from public.products p where p.id = product_id and p.owner_id = auth.uid())
);

-- votes
create policy "votes are public" on public.votes for select using (true);
create policy "users insert own votes" on public.votes for insert with check (auth.uid() = user_id);
create policy "users delete own votes" on public.votes for delete using (auth.uid() = user_id);

-- comments
create policy "comments are public" on public.comments for select using (true);
create policy "users insert own comments" on public.comments for insert with check (auth.uid() = user_id);
create policy "users delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- categories
create policy "categories are public" on public.categories for select using (true);

-- product_categories
create policy "product_categories are public" on public.product_categories for select using (true);
create policy "owners tag products" on public.product_categories for insert with check (
  exists (select 1 from public.products p where p.id = product_id and p.owner_id = auth.uid())
);
create policy "owners untag products" on public.product_categories for delete using (
  exists (select 1 from public.products p where p.id = product_id and p.owner_id = auth.uid())
);

-- waitlist: כל אחד יכול להירשם, רק בעל המוצר רואה את הרשימה
create policy "anyone joins waitlist" on public.waitlist_signups for insert with check (true);
create policy "owners read own waitlist" on public.waitlist_signups for select using (
  exists (select 1 from public.products p where p.id = product_id and p.owner_id = auth.uid())
);

-- newsletter: הרשמה בלבד (קריאה רק עם service role)
create policy "anyone subscribes" on public.newsletter_subscribers for insert with check (true);

-- ---------- Storage: לוגואים ----------

insert into storage.buckets (id, name, public)
values ('product-logos', 'product-logos', true)
on conflict (id) do nothing;

create policy "public read logos" on storage.objects
  for select using (bucket_id = 'product-logos');
create policy "authenticated upload logos" on storage.objects
  for insert with check (bucket_id = 'product-logos' and auth.role() = 'authenticated');

-- ---------- Seed: קטגוריות ----------

insert into public.categories (slug, name_he, name_en) values
  ('ai', 'בינה מלאכותית', 'AI'),
  ('saas', 'SaaS', 'SaaS'),
  ('fintech', 'פינטק', 'Fintech'),
  ('ecommerce', 'איקומרס', 'E-Commerce'),
  ('devtools', 'כלי פיתוח', 'Dev Tools'),
  ('mobile', 'אפליקציות', 'Mobile Apps'),
  ('productivity', 'פרודוקטיביות', 'Productivity'),
  ('marketing', 'שיווק', 'Marketing'),
  ('cyber', 'סייבר', 'Cybersecurity'),
  ('health', 'בריאות', 'Health'),
  ('edtech', 'חינוך', 'EdTech'),
  ('hardware', 'מוצר פיזי', 'Hardware'),
  ('ai-agents', 'סוכני AI', 'AI Agents'),
  ('accounting', 'ראיית חשבון', 'Accounting'),
  ('crm', 'CRM', 'CRM'),
  ('automations', 'אוטומציות', 'Automations');
