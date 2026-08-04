-- migration-v20 — Performance module, round 2: white-label reports, WhatsApp activity
-- updates, and the style-learning agent. Pairs with lib/performance/{report,notify,
-- style-profile,campaign-builder,oauth}.ts and app/report/[token], app/api/oauth/*.
-- Run once in the Supabase SQL editor, AFTER v18 (tenant features) and v19 (performance).

-- ── White-label reports: per-workspace branding + a public share token ──
alter table workspaces add column if not exists branding    jsonb default '{}'::jsonb;
alter table workspaces add column if not exists report_token text;
create unique index if not exists workspaces_report_token_idx on workspaces(report_token) where report_token is not null;

-- ── WhatsApp activity updates: opt-in flag on the performance settings ──
alter table performance_settings add column if not exists notify_whatsapp boolean not null default false;

-- ── Style-learning agent: one learned profile per workspace ──
create table if not exists performance_style (
  workspace_id         uuid primary key references workspaces(id) on delete cascade,
  naming_pattern       text,                                  -- e.g. '{brand}_{objective}_{date}'
  budget_strategy      text,
  default_daily_budget numeric default 100,
  default_countries    text[] default array['IL'],
  age_min              int default 18,
  age_max              int default 65,
  preferences          jsonb default '[]'::jsonb,             -- array of short strings
  learned_at           timestamptz,
  updated_at           timestamptz default now()
);

alter table performance_style enable row level security;
do $$ begin
  create policy pstyle_member on performance_style for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
