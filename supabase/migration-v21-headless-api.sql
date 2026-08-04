-- migration-v21 — Developer API / headless content distribution. Pairs with
-- lib/publish/*, lib/headless/store.ts, lib/distribution/headless.ts, app/api/{content,
-- publish}, app/[locale]/developer, and the `developer` feature toggle.
-- Run once in the Supabase SQL editor, after v18–v20.

-- Per-workspace Developer-API token (auth for the Pull feed + Push endpoint).
alter table workspaces add column if not exists content_api_token text;
create unique index if not exists workspaces_content_api_token_idx on workspaces(content_api_token) where content_api_token is not null;

-- The headless content feed a customer's site pulls (typed JSON) / pushes into.
create table if not exists headless_content (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  external_id  text,                                  -- caller's id → upsert key (re-publish updates in place)
  title        text not null,
  slug         text not null,
  html         text not null,
  excerpt      text,
  status       text not null default 'published'
               check (status in ('draft','published')),
  published_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists headless_content_ws_idx on headless_content(workspace_id, status, updated_at desc);
create unique index if not exists headless_content_extid_idx on headless_content(workspace_id, external_id) where external_id is not null;

alter table headless_content enable row level security;
do $$ begin
  create policy headless_member on headless_content for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
-- Note: the public Pull/Push API routes authenticate by content_api_token and use the
-- service-role client, so they bypass RLS deliberately (the token IS the auth).
