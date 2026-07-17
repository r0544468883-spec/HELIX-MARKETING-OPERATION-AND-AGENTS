-- ============================================================
-- HELIX STAGE — Migration v8
-- מערכת דיוור: קמפיינים, תבניות, מעקב, הסרה, פילוח
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1) הרשאת אדמין (לשליחה לכל רשימת הניוזלטר)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2) שדרוג נרשמי הניוזלטר: שם, הסרה, טוקן
alter table public.newsletter_subscribers
  add column if not exists name text,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

-- 3) תבניות מייל
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  subject text not null,
  body_html text not null,
  created_at timestamptz not null default now()
);

-- 4) קמפיינים
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  body_html text not null,
  from_name text,
  from_email text,
  segment text not null default 'all',        -- all | product_waitlist
  product_id uuid references public.products(id) on delete set null,
  locale_filter text,                          -- he | en | null
  status text not null default 'draft',        -- draft | sending | sent
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients integer not null default 0,
  opens integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists email_campaigns_owner_idx on public.email_campaigns (owner_id, created_at desc);

-- 5) שליחות פר-נמען (למעקב פתיחות/הקלקות)
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid(),
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_sends_campaign_idx on public.email_sends (campaign_id);
create index if not exists email_sends_token_idx on public.email_sends (token);

-- ---------- RLS ----------
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_sends enable row level security;

do $$ begin
  create policy "owners manage templates" on public.email_templates for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "owners manage campaigns" on public.email_campaigns for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "owners read sends" on public.email_sends for select using (
    exists (select 1 from public.email_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
exception when duplicate_object then null; end $$;
-- הכתיבה ל-sends ולעדכון פתיחות/הקלקות/הסרה נעשית בשרת עם service_role (עוקף RLS).
