-- HELIX OPS — Content Agent (per-channel drafts + AI-detection score)
-- Run after helix-ops-schema.sql.

create extension if not exists "pgcrypto";

create table if not exists content_drafts (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references requests(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel      text not null,
  language     text not null default 'he',
  body         text,
  ai_score     int,                 -- 0-100 "human-ness" (higher = reads more human)
  status       text not null default 'draft' check (status in ('draft','ready')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (request_id, channel)
);

alter table content_drafts enable row level security;
drop policy if exists draft_all on content_drafts;
create policy draft_all on content_drafts for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
