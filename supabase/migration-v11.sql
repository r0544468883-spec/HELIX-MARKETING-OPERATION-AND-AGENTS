-- ============================================================
-- HELIX OPS — Migration v11
-- Lead Radar: real-time opportunity/lead discovery from social sources
-- (Facebook groups via extension + API-native sources), intent scoring,
-- alerts, and hand-off to the engagement engine (Comment-to-DM / auto-reply).
-- Idempotent — safe to re-run. Depends on workspaces + is_member().
-- ============================================================

create extension if not exists "pgcrypto";

-- 1) A radar = "what leads am I looking for, where, and how do I get alerted".
create table if not exists radar_configs (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  name           text not null,
  keywords       text[] not null default '{}',
  icp            text,                                   -- who the ideal customer is (for intent scoring)
  sources        jsonb not null default '[]'::jsonb,     -- [{type:'fb_group',id}, {type:'reddit',sub}, ...]
  min_intent     numeric not null default 0.7,           -- 0..1 threshold
  alert_channels text[] not null default '{}',           -- ['טלגרם','וואטסאפ','מייל']
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists radar_ws_idx on radar_configs(workspace_id, active);

-- 2) A discovered lead (a real-time opportunity matched by a radar).
create table if not exists radar_leads (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  radar_id        uuid references radar_configs(id) on delete set null,
  source          text not null,                         -- 'fb_group' | 'reddit' | 'x' | ...
  source_ref      text,                                  -- group id / subreddit / etc.
  post_url        text,
  author          text,
  content         text,
  intent_score    numeric,                               -- 0..1
  matched         text[] not null default '{}',          -- which keywords hit
  status          text not null default 'new' check (status in ('new','contacted','saved','dismissed')),
  alerted         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists radar_leads_idx on radar_leads(workspace_id, status, created_at desc);

alter table radar_configs enable row level security;
alter table radar_leads   enable row level security;

do $$ begin
  create policy radar_cfg_all  on radar_configs for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy radar_lead_all on radar_leads   for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
