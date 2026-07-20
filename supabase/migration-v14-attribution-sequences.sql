-- migration-v14 — Marketing Attribution + Email Sequences + Payment loop
-- Harvested & rewritten (MIT) from krishna-build/claude-coach-kit, adapted to
-- HELIX: mkt_ prefix (no collision), env-driven, Stripe-shaped, RTL-friendly.
-- The three harvested parts: (1) UTM attribution, (2) email sequences, (3) payment + Google-Sheet inbound.

-- ── (1) UTM ATTRIBUTION ────────────────────────────────────────────────
create table if not exists mkt_visitors (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  visitor_id   text unique not null,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  city         text,
  region       text,
  country      text,
  device       text,
  page_url     text,
  first_visit  timestamptz default now(),
  -- attribution loop: set when a payment webhook matches this visitor
  payment_status text default 'none',       -- none | paid
  payment_amount numeric,
  paid_at        timestamptz,
  created_at   timestamptz default now()
);
create index if not exists idx_mkt_visitors_visitor_id on mkt_visitors(visitor_id);
create index if not exists idx_mkt_visitors_campaign    on mkt_visitors(utm_campaign);
create index if not exists idx_mkt_visitors_content     on mkt_visitors(utm_content);
create index if not exists idx_mkt_visitors_status      on mkt_visitors(payment_status);
create index if not exists idx_mkt_visitors_created     on mkt_visitors(created_at desc);
create index if not exists idx_mkt_visitors_compound    on mkt_visitors(payment_status, created_at desc);

-- ── SHARED: contacts (lead store, fed by Google-Sheet inbound + forms) ──
create table if not exists mkt_contacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  email        text not null,
  first_name   text,
  phone        text,
  status       text default 'active',        -- active | unsubscribed
  tags         text[] default '{}',
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (workspace_id, email)
);
create index if not exists idx_mkt_contacts_email on mkt_contacts(email);

-- ── (2) EMAIL SEQUENCES ────────────────────────────────────────────────
create table if not exists mkt_sequences (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name         text not null,
  status       text default 'active',        -- active | paused
  created_at   timestamptz default now()
);

create table if not exists mkt_sequence_steps (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid references mkt_sequences(id) on delete cascade,
  step_order    int not null,
  delay_hours   int default 24,              -- wait before this step relative to previous
  email_subject text not null,
  email_body    text not null,               -- HTML, supports {{first_name}} / {{email}} / {{phone}}
  unique (sequence_id, step_order)
);

create table if not exists mkt_sequence_enrollments (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid references mkt_sequences(id) on delete cascade,
  contact_id   uuid references mkt_contacts(id) on delete cascade,
  status       text default 'active',        -- active | completed | stopped
  current_step int default 1,
  next_send_at timestamptz default now(),
  completed_at timestamptz,
  created_at   timestamptz default now()
);
create index if not exists idx_mkt_enroll_due on mkt_sequence_enrollments(status, next_send_at);

create table if not exists mkt_email_log (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid,
  sequence_id uuid,
  step_id     uuid,
  track_id    uuid,
  email_to    text,
  subject     text,
  status      text default 'sent',           -- sent | opened | clicked | bounced
  sent_at     timestamptz default now(),
  opened_at   timestamptz,
  clicked_at  timestamptz
);
create index if not exists idx_mkt_email_log_track on mkt_email_log(track_id);

-- ── (3) PAYMENT + INBOUND WEBHOOK LOG ──────────────────────────────────
create table if not exists mkt_payments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  provider     text,                          -- stripe | paypal | manual
  external_id  text unique,                    -- provider payment/session id
  email        text,
  amount       numeric,
  currency     text default 'ILS',
  status       text,                           -- paid | refunded | failed
  visitor_id   text,                           -- links back to mkt_visitors (attribution loop)
  raw          jsonb,
  created_at   timestamptz default now()
);
create index if not exists idx_mkt_payments_email on mkt_payments(email);

create table if not exists mkt_webhook_log (
  id           uuid primary key default gen_random_uuid(),
  source       text,                           -- google_sheet | stripe | ...
  payload      jsonb,
  action_taken text,
  processed    boolean default false,
  created_at   timestamptz default now()
);

-- RLS: enable per-workspace like the rest of helix-ops (service-role bypasses).
alter table mkt_visitors            enable row level security;
alter table mkt_contacts            enable row level security;
alter table mkt_sequences           enable row level security;
alter table mkt_sequence_steps      enable row level security;
alter table mkt_sequence_enrollments enable row level security;
alter table mkt_email_log           enable row level security;
alter table mkt_payments            enable row level security;
alter table mkt_webhook_log         enable row level security;
