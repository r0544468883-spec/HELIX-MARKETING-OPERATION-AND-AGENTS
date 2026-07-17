-- ============================================================
-- HELIX STAGE — Migration v9
-- העשרת הדיוור: אנשי קשר, טופס הרשמה מוטמע, פילוח תגיות, תזמון
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1) רשימת אנשי הקשר של היזם (audience פרטי לכל יזם)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  name text,
  tags text[] not null default '{}',
  source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);
create index if not exists contacts_owner_idx on public.contacts (owner_id, created_at desc);

alter table public.contacts enable row level security;
do $$ begin
  create policy "owners manage contacts" on public.contacts for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

-- 2) טוקן לטופס הרשמה מוטמע (פר יזם)
alter table public.profiles
  add column if not exists subscribe_token uuid not null default gen_random_uuid();

-- 3) קמפיינים: פילוח לפי תגית + הרחבת סגמנט ל-my_contacts (השדה כבר text)
alter table public.email_campaigns
  add column if not exists tag_filter text;
