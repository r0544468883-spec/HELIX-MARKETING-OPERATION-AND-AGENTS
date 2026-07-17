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
