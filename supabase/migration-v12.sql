-- ============================================================
-- HELIX OPS — Migration v12
-- HELIX Agent OS: scheduled AI agents + daily digest.
-- Model router (Ollama local / Claude cloud). Idempotent.
-- Depends on workspaces + is_member().
-- ============================================================

create extension if not exists "pgcrypto";

-- 1) A scheduled agent = a single recurring task.
create table if not exists agents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,                               -- shown as the digest section title
  type          text not null default 'prompt',              -- handler key (registry)
  config        jsonb not null default '{}'::jsonb,           -- {system, prompt, channels[], ...}
  model_tier    text not null default 'auto' check (model_tier in ('local','quality','auto')),
  schedule_cron text,                                         -- optional cron hint (MVP runs on scheduler tick)
  timezone      text not null default 'Asia/Jerusalem',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists agents_ws_idx on agents(workspace_id, active);

-- 2) One row per agent execution.
create table if not exists agent_runs (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null references agents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status       text not null default 'ok' check (status in ('ok','fail')),
  output_md    text,
  model_used   text,
  error        text,
  started_at   timestamptz not null default now()
);
create index if not exists runs_agent_idx on agent_runs(agent_id, started_at desc);

-- 3) The composed daily digest per workspace.
create table if not exists digests (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  digest_date   date not null default current_date,
  body_md       text,
  channels      text[] not null default '{}',
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists digests_ws_idx on digests(workspace_id, digest_date desc);

-- 4) Per-workspace Ollama endpoint (managed shared, or the customer's local).
create table if not exists ollama_endpoints (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  mode         text not null default 'shared' check (mode in ('shared','local')),
  base_url     text not null,
  model        text not null default 'qwen3.5:4b',
  api_key      text,                                          -- for Ollama web_search / auth
  created_at   timestamptz not null default now(),
  unique (workspace_id)
);

alter table agents           enable row level security;
alter table agent_runs       enable row level security;
alter table digests          enable row level security;
alter table ollama_endpoints enable row level security;

do $$ begin
  create policy agents_all  on agents           for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy runs_all    on agent_runs       for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy digests_all on digests          for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy ollama_all  on ollama_endpoints for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
