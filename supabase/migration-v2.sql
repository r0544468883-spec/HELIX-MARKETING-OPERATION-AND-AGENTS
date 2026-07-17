-- ============================================================
-- HELIX STAGE — Migration v2
-- תפקידים + אונבורדינג + קטגוריות חדשות + מעבר להעלאות יומיות
-- בטוח להרצה חוזרת. הרצה: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================

-- 1) profiles: תפקיד (גולש/יזם), דגל אונבורדינג, תחומי עניין
alter table public.profiles
  add column if not exists user_type text not null default 'consumer',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists interests integer[] not null default '{}';

do $$ begin
  alter table public.profiles
    add constraint profiles_user_type_check check (user_type in ('consumer', 'maker'));
exception when duplicate_object then null; end $$;

-- 2) מי שכבר העלה מוצר הוא יזם
update public.profiles set user_type = 'maker'
where id in (select owner_id from public.products);

-- 3) העלאות יומיות: השקות שתוזמנו לעתיד עולות היום
update public.launches set launch_date = current_date
where launch_date > current_date;

-- 4) קטגוריות חדשות
insert into public.categories (slug, name_he, name_en) values
  ('ai-agents', 'סוכני AI', 'AI Agents'),
  ('accounting', 'ראיית חשבון', 'Accounting'),
  ('crm', 'CRM', 'CRM'),
  ('automations', 'אוטומציות', 'Automations')
on conflict (slug) do nothing;
