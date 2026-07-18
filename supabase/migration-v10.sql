-- ============================================================
-- HELIX OPS — Migration v10
-- Engagement engine: Fuzzy-AI comments, Comment-to-DM funnels,
-- auto-reply DM threads, safety rate-limits + consent, signal mining.
-- Idempotent — safe to re-run. Run: Supabase Dashboard -> SQL Editor.
-- Depends on: workspaces + is_member(workspace_id) (helix-ops-schema.sql).
-- ============================================================

create extension if not exists "pgcrypto";

-- 1) Comment-to-DM funnels: keyword on a post -> public reply + private DM.
create table if not exists comment_funnels (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  channel           text not null,                         -- 'פייסבוק' | 'אינסטגרם'
  post_url          text,
  post_id           text,                                  -- platform post id (for webhook matching)
  keyword           text not null,                         -- trigger word
  public_reply_text text not null,                         -- reply under the comment
  dm_message        text not null,                         -- private DM wording (supports {{vars}})
  dm_flow           jsonb not null default '[]'::jsonb,     -- follow-up steps
  tier              text not null default 'compliant' check (tier in ('compliant','risk')),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists funnels_ws_idx on comment_funnels(workspace_id, active);
create index if not exists funnels_match_idx on comment_funnels(post_id, keyword);

-- 2) Leads captured by a funnel.
create table if not exists funnel_leads (
  id             uuid primary key default gen_random_uuid(),
  funnel_id      uuid not null references comment_funnels(id) on delete cascade,
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  commenter      text,                                     -- platform user id / name
  comment_text   text,
  public_replied boolean not null default false,
  dm_sent        boolean not null default false,
  dm_status      text not null default 'pending' check (dm_status in ('pending','sent','failed','skipped')),
  captured_at    timestamptz not null default now()
);
create index if not exists leads_funnel_idx on funnel_leads(funnel_id, captured_at desc);

-- 3) Fuzzy-AI engagement targets (posts discovered in feeds/groups/profiles).
create table if not exists engagement_targets (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  channel         text not null,
  source          text not null check (source in ('feed','group','profile','mention')),
  post_url        text,
  author          text,
  content         text,
  relevance_score numeric,                                 -- 0..1 fuzzy score
  decision        text not null default 'pending' check (decision in ('pending','comment','like','skip')),
  created_at      timestamptz not null default now()
);
create index if not exists targets_ws_idx on engagement_targets(workspace_id, decision, created_at desc);

-- 4) Engagement actions (a comment/reply/like) with HITL status.
create table if not exists engagement_actions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel      text not null,
  target_id    uuid references engagement_targets(id) on delete set null,
  type         text not null check (type in ('comment','reply','like','dm')),
  content      text,
  status       text not null default 'suggested' check (status in ('suggested','approved','posted','skipped','failed')),
  external_id  text,
  error        text,
  created_at   timestamptz not null default now(),
  posted_at    timestamptz
);
create index if not exists actions_ws_idx on engagement_actions(workspace_id, status, created_at desc);

-- 5) Per-workspace/channel safety limits ("under the radar").
create table if not exists engagement_limits (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  channel       text not null,
  daily_cap     int not null default 15,
  used_today    int not null default 0,
  used_date     date not null default current_date,
  warmup_stage  int not null default 1,                    -- 1..N; ramps the effective cap
  last_action_at timestamptz,
  risk_level    text not null default 'green' check (risk_level in ('green','amber','red')),
  paused        boolean not null default false,            -- kill-switch
  created_at    timestamptz not null default now(),
  unique (workspace_id, channel)
);

-- 6) DM threads (auto-reply inbox).
create table if not exists dm_threads (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  channel            text not null,
  contact            text not null,
  last_msg           text,
  intent             text check (intent in ('lead','question','spam','other')),
  auto_reply_enabled boolean not null default false,
  updated_at         timestamptz not null default now(),
  unique (workspace_id, channel, contact)
);

-- 7) Explicit risk consent for gray channels (LinkedIn/Meta browser automation).
create table if not exists risk_consents (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references workspaces(id) on delete cascade,
  channel              text not null,
  consented_at         timestamptz not null default now(),
  consent_text_version text not null default 'v1',
  unique (workspace_id, channel)
);

-- 8) Mined signals (raw material for the autonomous content loop).
create table if not exists signals (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  source          text not null,                           -- 'gsc' | 'crm' | 'sales' | ...
  raw             text not null,
  used_in_post_id uuid,
  created_at      timestamptz not null default now()
);
create index if not exists signals_ws_idx on signals(workspace_id, created_at desc);

-- RLS — all tables scoped by workspace membership.
alter table comment_funnels    enable row level security;
alter table funnel_leads       enable row level security;
alter table engagement_targets enable row level security;
alter table engagement_actions enable row level security;
alter table engagement_limits  enable row level security;
alter table dm_threads         enable row level security;
alter table risk_consents      enable row level security;
alter table signals            enable row level security;

do $$ begin
  create policy funnels_all   on comment_funnels    for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy leads_all     on funnel_leads       for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy targets_all   on engagement_targets for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy actions_all   on engagement_actions for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy limits_all    on engagement_limits  for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy dm_all        on dm_threads         for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy consents_all  on risk_consents      for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy signals_all   on signals            for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
