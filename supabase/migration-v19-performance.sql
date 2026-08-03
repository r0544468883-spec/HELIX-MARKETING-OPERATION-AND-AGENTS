-- migration-v19 — Performance module: creative pool, live metrics, per-workspace
-- settings (metric/execution mode/autonomy), and a decision log.
-- Pairs with lib/performance/* and app/[locale]/performance.
-- Run once in the Supabase SQL editor (same convention as v1–v18).

-- ── The creative pool the client seeds (we never generate; see product spec) ──
create table if not exists creatives (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  platform     text not null,                       -- 'Meta' | 'TikTok' | 'Google' | 'Outbrain' | ...
  format       text,                                -- 'video' | 'image' | 'carousel' | 'text'
  headline     text,
  body         text,
  hook         text,                                -- first 3s / opening line
  media_url    text,
  external_id  text,                                -- id in the ad platform (connector mode)
  external_ref jsonb default '{}'::jsonb,           -- {adId, adsetId, campaignId} for execution
  status       text not null default 'draft'
               check (status in ('draft','live','paused','retired')),
  cold_start   int,                                 -- cached AI prior 0..100
  cold_reason  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists creatives_ws_idx on creatives(workspace_id, status);

-- ── Live metrics per creative (the client's own data — brain OR connector feeds it) ──
create table if not exists creative_metrics (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  creative_id  uuid not null references creatives(id) on delete cascade,
  platform     text,
  spend        numeric default 0,
  impressions  bigint  default 0,
  clicks       bigint  default 0,
  conversions  bigint  default 0,
  revenue      numeric default 0,
  as_of        timestamptz default now()            -- snapshot time (latest wins in the engine)
);
create index if not exists creative_metrics_idx on creative_metrics(creative_id, as_of desc);

-- ── Per-workspace performance settings ──
create table if not exists performance_settings (
  workspace_id    uuid primary key references workspaces(id) on delete cascade,
  metric          text not null default 'cpa'
                  check (metric in ('cpa','roas','cpl','ctr')),
  execution_mode  text not null default 'brain'
                  check (execution_mode in ('brain','connector')),  -- brain=decide only; connector=also act
  autonomy        text not null default 'approve'
                  check (autonomy in ('approve','autopilot')),
  pause_below     int  not null default 35,          -- blended score under this → pause (when confident)
  promote_above   int  not null default 70,          -- blended score over this → scale up / promote
  updated_at      timestamptz default now()
);

-- ── Decision log — every pause/scale/promote the engine proposes or applies ──
create table if not exists performance_decisions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  creative_id  uuid references creatives(id) on delete cascade,
  action       text not null
               check (action in ('pause','scale_up','scale_down','promote','keep')),
  reason       text,
  score        int,                                  -- blended score at decision time
  confidence   numeric,                              -- 0..1 dataWeight at decision time
  status       text not null default 'pending'
               check (status in ('pending','approved','applied','rejected')),
  created_at   timestamptz default now(),
  applied_at   timestamptz
);
create index if not exists perf_decisions_idx on performance_decisions(workspace_id, status, created_at desc);

-- ── RLS (same is_member helper as the base schema) ──
alter table creatives             enable row level security;
alter table creative_metrics      enable row level security;
alter table performance_settings  enable row level security;
alter table performance_decisions enable row level security;

do $$ begin
  create policy creatives_member on creatives for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy cmetrics_member on creative_metrics for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy psettings_member on performance_settings for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pdecisions_member on performance_decisions for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
