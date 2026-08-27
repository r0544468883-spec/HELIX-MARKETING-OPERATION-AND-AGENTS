-- migration-v23 — Media Buyers module: media plans, buys (Auto + Managed lanes),
-- publisher deals (the Managed lane — direct IO/PMP/PG with Israeli publishers), per-buy
-- metrics (actual vs promised), and creative links. Pairs with app/[locale]/media-buying,
-- app/actions-media-buying.ts, and lib/performance/connectors/* (Auto lane).
-- Run once in the Supabase SQL editor, AFTER v22 (uses is_member from v22). Idempotent.

-- ── Media plan: a client's goal + budget, split across channels ──
create table if not exists media_plans (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  client_id    uuid references client_profiles(id) on delete set null,
  name         text not null,
  objective    text not null default 'traffic'
               check (objective in ('awareness','traffic','leads','sales','engagement')),
  total_budget numeric default 0,
  currency     text not null default 'ILS',
  start_date   date,
  end_date     date,
  status       text not null default 'draft'
               check (status in ('draft','active','done','archived')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists media_plans_ws_idx on media_plans(workspace_id, status);

-- ── Media buy: one purchase. lane=auto → runs through an AdConnector; lane=managed →
--    tracked as a publisher_deal. external_ref carries {campaignId/adsetId} (auto) or
--    {dealId} (DV360 / programmatic) once activated. ──
create table if not exists media_buys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  plan_id      uuid references media_plans(id) on delete set null,
  client_id    uuid references client_profiles(id) on delete set null,
  lane         text not null default 'auto' check (lane in ('auto','managed')),
  channel      text not null,                       -- 'meta'|'google'|'taboola'|'dv360'|'ynet'|'walla'|...
  status       text not null default 'draft'
               check (status in ('draft','pending_approval','live','paused','ended')),
  budget       numeric default 0,
  target_kpi   jsonb default '{}'::jsonb,           -- {metric:'cpa'|'roas'|..., value:number}
  autonomy_mode text not null default 'advisor'
               check (autonomy_mode in ('advisor','approve','autopilot')),
  external_ref jsonb default '{}'::jsonb,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists media_buys_ws_idx on media_buys(workspace_id, lane, status);
create index if not exists media_buys_plan_idx on media_buys(plan_id);

-- ── Publisher deal (Managed lane): the direct buy pipeline with a publisher. No API —
--    negotiated by a human, tracked here through stages, up to pacing vs the promise. ──
create table if not exists publisher_deals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  buy_id        uuid references media_buys(id) on delete cascade,
  client_id     uuid references client_profiles(id) on delete set null,
  publisher     text not null,                      -- 'Ynet'|'Walla'|'Sport5'|'Globes'|...
  stage         text not null default 'proposed'
                check (stage in ('proposed','negotiating','approved','live','ended')),
  deal_type     text not null default 'io'
                check (deal_type in ('io','pmp','pg','preferred')),
  unit          text not null default 'cpm'
                check (unit in ('cpm','cpd','fixed')),
  rate          numeric default 0,
  guaranteed_impressions bigint default 0,
  deal_id       text,                               -- programmatic Deal ID (once PMP/PG in DV360)
  inventory     jsonb default '{}'::jsonb,          -- {formats:[], placements:[]}
  deadline      date,
  io_document_url text,
  contact_name  text,
  contact_email text,
  invoice_status text not null default 'none'
                check (invoice_status in ('none','received','paid')),
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists publisher_deals_ws_idx on publisher_deals(workspace_id, stage);
create index if not exists publisher_deals_buy_idx on publisher_deals(buy_id);

-- ── Per-buy metrics: actual delivery, plus promised (Managed pacing). Latest per date. ──
create table if not exists buy_metrics (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  buy_id       uuid not null references media_buys(id) on delete cascade,
  as_of        date not null default current_date,
  impressions  bigint  default 0,
  clicks       bigint  default 0,
  spend        numeric default 0,
  conversions  bigint  default 0,
  revenue      numeric default 0,
  promised_impressions bigint default 0,            -- Managed: prorated promise for pacing
  source       text not null default 'manual'
               check (source in ('connector','manual','csv')),
  created_at   timestamptz default now()
);
create index if not exists buy_metrics_idx on buy_metrics(buy_id, as_of desc);

-- ── Creative ↔ buy link (creatives live in the v19 `creatives` pool / media library) ──
create table if not exists buy_creatives (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  buy_id        uuid not null references media_buys(id) on delete cascade,
  creative_id   uuid references creatives(id) on delete set null,
  variant_label text,
  status        text not null default 'testing'
                check (status in ('testing','winner','paused')),
  voice_profile_id uuid,                            -- ties into the voice-cloning layer
  created_at    timestamptz default now()
);
create index if not exists buy_creatives_idx on buy_creatives(buy_id, status);

-- ── RLS — every table gated by is_member(workspace_id) (agency admins inherit via v22) ──
alter table media_plans     enable row level security;
alter table media_buys      enable row level security;
alter table publisher_deals enable row level security;
alter table buy_metrics     enable row level security;
alter table buy_creatives   enable row level security;

do $$ begin
  create policy media_plans_member on media_plans for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy media_buys_member on media_buys for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy publisher_deals_member on publisher_deals for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy buy_metrics_member on buy_metrics for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy buy_creatives_member on buy_creatives for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
