-- Content Voice — the operator's OWN authentic writing voice, learned from real posts
-- they paste (the same inputs as Content DNA). Injected into the Post Builder / channel
-- drafts as few-shot style anchors so generated content sounds like them, not a generic
-- voice. One profile per workspace. Member-scoped via the shared is_member() helper.

create table if not exists content_voice (
  workspace_id       uuid primary key references workspaces(id) on delete cascade,
  key_tells          jsonb not null default '[]'::jsonb,          -- 3-5 enforced fingerprint rules
  signature_passages jsonb not null default '[]'::jsonb,          -- verbatim style-extreme excerpts
  summary            text,                                        -- one-line voice description
  words              int  not null default 0,                     -- sample size analysed
  tier               text not null default 'basic' check (tier in ('basic','strong','full')),
  lang               text not null default 'he' check (lang in ('he','en')),
  learned_at         timestamptz not null default now()
);

alter table content_voice enable row level security;
do $$ begin
  create policy cvoice_member on content_voice for all
    using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
