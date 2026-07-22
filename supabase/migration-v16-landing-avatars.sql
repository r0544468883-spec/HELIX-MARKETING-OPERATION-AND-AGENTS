-- migration-v16 — Landing Page Builder + Avatar/Video generation
-- Landing pages (template-based, per-industry) + lead capture (feeds attribution).
-- Avatar jobs (HeyGen/D-ID/ElevenLabs, hybrid BYOK/managed) + usage tracking.

-- ── Landing pages ──────────────────────────────────────────────────────
create table if not exists landing_pages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id  uuid,                                  -- optional link to a campaign
  name         text not null,
  slug         text unique not null,                  -- public URL /lp/<slug>
  template     text,                                  -- template key
  vertical     text,                                  -- ecommerce | saas | clinic | ...
  ux_style     text default 'minimal',                -- minimal | bold | luxury | dark | editorial
  sections     jsonb default '[]'::jsonb,             -- ordered typed blocks
  published    boolean default false,
  views        int default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_landing_slug on landing_pages(slug);

-- Leads captured from a landing form → also feed attribution (mkt_visitors).
create table if not exists landing_leads (
  id           uuid primary key default gen_random_uuid(),
  landing_id   uuid references landing_pages(id) on delete cascade,
  workspace_id uuid not null,
  fields       jsonb default '{}'::jsonb,             -- {name,email,phone,...}
  utm          jsonb default '{}'::jsonb,
  created_at   timestamptz default now()
);

-- ── Avatar / video generation jobs ─────────────────────────────────────
create table if not exists avatar_jobs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  variant_id    uuid,                                 -- content_variants.id (or null for standalone)
  landing_id    uuid,                                 -- landing_pages.id (video block)
  provider      text not null,                        -- heygen | did
  external_id   text,                                 -- provider job id
  status        text default 'processing',            -- processing | done | failed
  video_url     text,
  managed       boolean default false,                -- true = used HELIX key (bill usage)
  error         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_avatar_jobs_status on avatar_jobs(status);

-- Managed-usage ledger (for billing customers who use HELIX's key).
create table if not exists avatar_usage (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  provider     text not null,
  units        numeric default 1,                     -- videos / seconds
  created_at   timestamptz default now()
);

alter table landing_pages enable row level security;
alter table landing_leads enable row level security;
alter table avatar_jobs   enable row level security;
alter table avatar_usage  enable row level security;
do $$ begin
  create policy lp_member on landing_pages for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy lead_member on landing_leads for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy aj_member on avatar_jobs for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy au_member on avatar_usage for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;

-- landing_pages public read of PUBLISHED pages (for the /lp render, anon).
do $$ begin
  create policy lp_public_read on landing_pages for select using (published = true);
exception when duplicate_object then null; end $$;
