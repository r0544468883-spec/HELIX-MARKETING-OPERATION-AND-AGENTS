-- v22: email suppression list (clean-room helix-email-campaigns core)
-- Every sender checks this before sending. Populated by bounces/complaints
-- (Resend webhook) and manual adds. Unsubscribes stay in newsletter_subscribers;
-- suppressedEmails() checks both.

create table if not exists email_suppression (
  email      text primary key,
  reason     text not null default 'manual',  -- bounce | complaint | manual
  source     text not null default 'system',
  created_at timestamptz not null default now()
);

comment on table email_suppression is 'Addresses that must never be emailed (hard bounces, spam complaints, manual).';

-- Server-only. Writes go through the service role (admin client); no public access.
alter table email_suppression enable row level security;

-- No policies for anon/authenticated => RLS denies all client access by default.
-- The service_role key bypasses RLS for the send path and the bounce webhook.
