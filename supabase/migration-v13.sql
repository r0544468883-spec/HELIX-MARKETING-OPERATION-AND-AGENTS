-- ============================================================
-- HELIX OPS — Migration v13
-- Media Library + Auto-Ingest, Client Profiles, Performance tracking,
-- and the Learning Loop. Idempotent. Depends on workspaces + is_member().
-- ============================================================

create extension if not exists "pgcrypto";

-- 1) Client profile — conditions all content generation (audience, voice, style).
create table if not exists client_profiles (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  audience     text,                                    -- target audience
  voice        text,                                    -- brand voice / tone
  dos_donts    text,                                    -- style rules
  lang         text not null default 'he' check (lang in ('he','en','both')),
  created_at   timestamptz not null default now()
);
create index if not exists client_ws_idx on client_profiles(workspace_id);

-- 2) Media asset — a ready file dropped for the agent to caption + schedule.
--    Each has a unique asset_ref to prevent duplication and enable tracking.
create table if not exists media_assets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  client_id       uuid references client_profiles(id) on delete set null,
  asset_ref       text not null,                        -- unique human id (e.g. filename convention)
  title           text,
  description     text,                                 -- what the media is about (caption prompt source)
  topic           text,
  storage_path    text,                                 -- Supabase Storage path / URL
  target_networks text[] not null default '{}',         -- channels to publish to
  priority        int not null default 3,
  scheduled_at    timestamptz,                          -- desired publish time (null = agent decides)
  status          text not null default 'new' check (status in ('new','scheduled','published','skipped')),
  created_at      timestamptz not null default now(),
  unique (workspace_id, asset_ref)
);
create index if not exists media_new_idx on media_assets(workspace_id, status, created_at desc);

-- 3) Post performance — metrics per published post per network (weekly tracking).
create table if not exists post_performance (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  publication_id uuid references publications(id) on delete cascade,
  asset_id       uuid references media_assets(id) on delete set null,
  network        text not null,
  reach          int,
  impressions    int,
  engagement     int,                                   -- likes+comments+shares
  clicks         int,
  collected_at   timestamptz not null default now()
);
create index if not exists perf_ws_idx on post_performance(workspace_id, network, collected_at desc);

-- 4) Learning insights — what the loop concluded (best times, winning patterns).
create table if not exists learning_insights (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  network      text,
  insight_type text not null,                           -- 'best_hour' | 'top_pattern' | ...
  value        jsonb not null default '{}'::jsonb,
  confidence   numeric,
  updated_at   timestamptz not null default now(),
  unique (workspace_id, network, insight_type)
);
create index if not exists insights_ws_idx on learning_insights(workspace_id, network);

alter table client_profiles   enable row level security;
alter table media_assets      enable row level security;
alter table post_performance  enable row level security;
alter table learning_insights enable row level security;

do $$ begin
  create policy clients_all  on client_profiles   for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy media_all    on media_assets      for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy perf_all     on post_performance  for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy insights_all on learning_insights for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
