-- migration-v15 — Campaign Builder + A/B Variants
-- A campaign fans out to per-channel assets (facebook/google_ads/linkedin/seo/…),
-- each holding up to ~6 content variants for A/B testing. Winner chosen by perf.

create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name         text not null,
  goal         text,                                  -- awareness | leads | sales | traffic | ...
  brief        text,
  channels     text[] default '{}',                   -- facebook, instagram, google_ads, linkedin, seo
  -- Campaign creation guidance (from UI or bot): client persona + budgets.
  client_profile jsonb default '{}'::jsonb,            -- {name, audience, voice, product, dos_donts}
  budget         jsonb default '{}'::jsonb,            -- {total, currency, per_channel:{facebook:…}}
  status       text default 'draft',                  -- draft | ready | live | done
  source       text default 'app',                    -- app | bot
  created_at   timestamptz default now()
);

-- One asset per (campaign, channel). Holds the channel-specific structure in
-- `payload` (e.g. Google RSA headlines/descriptions, or an SEO keyword plan).
create table if not exists campaign_assets (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  workspace_id uuid not null,
  channel      text not null,
  kind         text default 'social',                 -- social | search_ads | seo
  budget       numeric,                                -- allocated budget for this channel
  status       text default 'pending',                -- pending | ready (incremental build)
  payload      jsonb default '{}'::jsonb,              -- channel-specific structured output
  created_at   timestamptz default now()
);

-- Up to ~6 A/B variants per asset (or standalone publication via campaign_asset_id null).
create table if not exists content_variants (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null,
  campaign_asset_id uuid references campaign_assets(id) on delete cascade,
  channel           text not null,
  variant_index     int not null,                      -- global index (0..35)
  angle             text,                              -- the persuasion angle label
  angle_index       int default 0,                     -- which angle (0..5)
  variation_index   int default 0,                     -- variation within the angle (0..5)
  body              text not null,
  language          text default 'he',                 -- he | en
  ai_score          int default 0,                     -- 0-100 human-ness gate
  -- A/B performance PER VARIANT — synced from the platform after publishing.
  impressions       int default 0,
  views             int default 0,                     -- video views
  clicks            int default 0,
  conversions       int default 0,
  is_winner         boolean default false,
  published         boolean default false,             -- published to its channel?
  published_at      timestamptz,
  external_id       text,                              -- platform post/creative id (for insights)
  video_url         text,                              -- attached video (from Video Studio) for video posts
  created_at        timestamptz default now()
);
create index if not exists idx_variants_asset on content_variants(campaign_asset_id);

-- Publish mode/media on the existing publications log (multi-variant, organic/paid/video).
alter table publications add column if not exists mode      text default 'organic'; -- organic | paid | video
alter table publications add column if not exists media_url text;
alter table publications add column if not exists variant_id uuid;

-- Map a bot chat (telegram chat id / whatsapp phone / email) to a workspace so
-- every function is reachable from the bot with the right RLS scope.
create table if not exists bot_links (
  channel      text not null,                          -- telegram | whatsapp | email
  identifier   text not null,                          -- chat id / phone / email
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (channel, identifier)
);
alter table bot_links enable row level security;
do $$ begin
  create policy botlink_member on bot_links for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;

alter table campaigns          enable row level security;
alter table campaign_assets    enable row level security;
alter table content_variants   enable row level security;
do $$ begin
  create policy camp_member on campaigns for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy campasset_member on campaign_assets for all using (is_member(workspace_id)) with check (is_member(workspace_id));
  create policy variant_member on content_variants for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
