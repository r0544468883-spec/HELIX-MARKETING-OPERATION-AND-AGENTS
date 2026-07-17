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
