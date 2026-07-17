-- HELIX OPS — Distribution engine (channel connections + publications)
-- Run after helix-ops-schema.sql + helix-ops-content.sql.

create extension if not exists "pgcrypto";

-- Per-workspace channel setup (tokens, chat ids, recipients — stored as JSON config).
create table if not exists channel_connections (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel      text not null,                 -- 'וואטסאפ' | 'טלגרם' | 'מייל' | ...
  config       jsonb not null default '{}'::jsonb,
  active       boolean default true,
  created_at   timestamptz default now(),
  unique (workspace_id, channel)
);

-- One row per (content → channel) publish attempt.
create table if not exists publications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  request_id   uuid references requests(id) on delete cascade,
  channel      text not null,
  content      text not null,
  scheduled_at timestamptz,                   -- null = send immediately
  status       text not null default 'pending' check (status in ('pending','sent','failed')),
  external_id  text,
  error        text,
  created_at   timestamptz default now(),
  sent_at      timestamptz
);
create index if not exists publications_due_idx on publications(status, scheduled_at);

alter table channel_connections enable row level security;
alter table publications        enable row level security;

drop policy if exists chan_all on channel_connections;
create policy chan_all on channel_connections for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

drop policy if exists pub_all on publications;
create policy pub_all on publications for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));
