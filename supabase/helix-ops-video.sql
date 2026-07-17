-- HELIX OPS — Video Studio (compose uploaded clips/images/audio into a video)
-- Run after helix-ops-schema.sql.

create extension if not exists "pgcrypto";

create table if not exists video_projects (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references requests(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  timeline_json jsonb default '{}'::jsonb,   -- clips order/durations + captions + audio
  status        text not null default 'draft' check (status in ('draft','rendering','ready')),
  video_url     text,                        -- final rendered MP4 (→ used by TikTok/YouTube adapters)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (request_id)
);

alter table video_projects enable row level security;
drop policy if exists video_all on video_projects;
create policy video_all on video_projects for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
