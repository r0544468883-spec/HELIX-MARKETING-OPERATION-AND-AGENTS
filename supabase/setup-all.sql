-- HELIX OPS — full setup. Paste into Supabase SQL Editor and Run.


-- ===== helix-ops-schema.sql =====
-- HELIX OPS (Marketing Ops Hub) — MVP schema
-- Run once in Supabase SQL editor. Covers: workspaces, memberships, requests + RLS.

create extension if not exists "pgcrypto";

-- ---------- Workspaces (client/brand). plan gates features. ----------
create table if not exists workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  plan       text not null default 'solo' check (plan in ('solo','business','agency')),
  branding   jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- ---------- Memberships (user <-> workspace + role) ----------
create table if not exists memberships (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  role         text not null default 'admin' check (role in ('admin','member','approver','guest')),
  created_at   timestamptz default now(),
  primary key (workspace_id, user_id)
);

-- ---------- Requests (creative request intake — the MVP wedge) ----------
create table if not exists requests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  title        text not null,
  brief        text,
  channels     text[] default '{}',
  due_date     date,
  priority     text default 'normal' check (priority in ('low','normal','high','urgent')),
  status       text not null default 'new' check (status in ('new','in_progress','review','approved','done')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists requests_workspace_idx on requests(workspace_id, status);

-- ---------- helpers ----------
create or replace function is_member(ws uuid)
returns boolean language sql security definer stable as $$
  select exists (select 1 from memberships m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

-- atomic: create a workspace AND make the creator its admin (avoids RLS chicken-and-egg)
create or replace function create_workspace(ws_name text)
returns uuid language plpgsql security definer as $$
declare new_id uuid;
begin
  insert into workspaces (name, created_by) values (ws_name, auth.uid()) returning id into new_id;
  insert into memberships (workspace_id, user_id, role) values (new_id, auth.uid(), 'admin');
  return new_id;
end; $$;

-- ---------- RLS ----------
alter table workspaces  enable row level security;
alter table memberships enable row level security;
alter table requests    enable row level security;

drop policy if exists ws_select on workspaces;
create policy ws_select on workspaces for select using (is_member(id));
drop policy if exists ws_insert on workspaces;
create policy ws_insert on workspaces for insert with check (auth.uid() = created_by);

drop policy if exists mem_select on memberships;
create policy mem_select on memberships for select using (user_id = auth.uid() or is_member(workspace_id));
drop policy if exists mem_insert on memberships;
create policy mem_insert on memberships for insert with check (user_id = auth.uid());

drop policy if exists req_select on requests;
create policy req_select on requests for select using (is_member(workspace_id));
drop policy if exists req_insert on requests;
create policy req_insert on requests for insert with check (is_member(workspace_id) and requester_id = auth.uid());
drop policy if exists req_update on requests;
create policy req_update on requests for update using (is_member(workspace_id));

-- ===== helix-ops-approval.sql =====
-- HELIX OPS — Approval Flow (assets, versions, on-asset comments, approvals)
-- Run after helix-ops-schema.sql. Also create a public Storage bucket named 'ops-assets'.

create extension if not exists "pgcrypto";

-- Assets belong to a request. current_version points at the latest version number.
create table if not exists assets (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references requests(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  title           text,
  current_version int  not null default 1,
  created_at      timestamptz default now()
);

create table if not exists asset_versions (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references assets(id) on delete cascade,
  version    int  not null,
  image_url  text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- On-asset comments: x/y are percentages (0-100) over the image.
create table if not exists comments (
  id               uuid primary key default gen_random_uuid(),
  asset_version_id uuid not null references asset_versions(id) on delete cascade,
  author_id        uuid references auth.users(id) on delete set null,
  x                real,
  y                real,
  body             text not null,
  resolved         boolean default false,
  created_at       timestamptz default now()
);

create table if not exists approvals (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references assets(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  decision    text not null check (decision in ('approved','changes_requested')),
  note        text,
  created_at  timestamptz default now()
);

-- ---------- RLS (members of the workspace can act) ----------
alter table assets         enable row level security;
alter table asset_versions enable row level security;
alter table comments       enable row level security;
alter table approvals      enable row level security;

drop policy if exists asset_all on assets;
create policy asset_all on assets for all using (is_member(workspace_id)) with check (is_member(workspace_id));

drop policy if exists ver_all on asset_versions;
create policy ver_all on asset_versions for all
  using (exists (select 1 from assets a where a.id = asset_id and is_member(a.workspace_id)))
  with check (exists (select 1 from assets a where a.id = asset_id and is_member(a.workspace_id)));

drop policy if exists comment_all on comments;
create policy comment_all on comments for all
  using (exists (
    select 1 from asset_versions v join assets a on a.id = v.asset_id
    where v.id = asset_version_id and is_member(a.workspace_id)
  ))
  with check (exists (
    select 1 from asset_versions v join assets a on a.id = v.asset_id
    where v.id = asset_version_id and is_member(a.workspace_id)
  ));

drop policy if exists approval_all on approvals;
create policy approval_all on approvals for all
  using (exists (select 1 from assets a where a.id = asset_id and is_member(a.workspace_id)))
  with check (exists (select 1 from assets a where a.id = asset_id and is_member(a.workspace_id)));

-- ===== helix-ops-content.sql =====
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

-- ===== helix-ops-distribution.sql =====
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

-- ===== helix-ops-brand.sql =====
-- HELIX OPS — Phase 2: Brand Vault + Brand Linter
-- Run after helix-ops-schema.sql + helix-ops-approval.sql.

create extension if not exists "pgcrypto";

-- One brand guide per workspace (the rules the linter checks against).
create table if not exists brand_guides (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  colors       text[] default '{}',   -- hex palette
  fonts        text[] default '{}',   -- allowed font families
  logo_url     text,                  -- official logo reference
  disclaimers  text[] default '{}',   -- required text/legal disclaimers
  notes        text,
  updated_at   timestamptz default now()
);

-- Linter result per asset version.
create table if not exists brand_checks (
  asset_version_id uuid primary key references asset_versions(id) on delete cascade,
  score            int,               -- 0-100 compliance
  violations       jsonb default '[]'::jsonb,
  checked_at       timestamptz default now()
);

alter table brand_guides enable row level security;
alter table brand_checks enable row level security;

drop policy if exists guide_all on brand_guides;
create policy guide_all on brand_guides for all
  using (is_member(workspace_id)) with check (is_member(workspace_id));

drop policy if exists check_all on brand_checks;
create policy check_all on brand_checks for all
  using (exists (
    select 1 from asset_versions v join assets a on a.id = v.asset_id
    where v.id = asset_version_id and is_member(a.workspace_id)
  ))
  with check (exists (
    select 1 from asset_versions v join assets a on a.id = v.asset_id
    where v.id = asset_version_id and is_member(a.workspace_id)
  ));
