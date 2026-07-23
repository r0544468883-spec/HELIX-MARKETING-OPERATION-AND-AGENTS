-- migration-v17 — Custom (workspace-uploaded) message templates.
-- A workspace defines its OWN templates for any message type instead of (or on top
-- of) the built-in catalog. `definition` holds the shape per kind (whatsapp:
-- TemplateDef — name/language/category/body/params/sampleParams/…). A custom row
-- with the same key as a built-in OVERRIDES it in the merged view. WhatsApp customs
-- still need /api/templates/sync + Meta approval before they can send out-of-window.

create table if not exists custom_templates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  kind         text not null,                         -- 'whatsapp'
  key          text not null,                         -- logical key (overrides a built-in with same key)
  definition   jsonb not null,                        -- the template shape (per kind)
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (workspace_id, kind, key)
);
create index if not exists idx_custom_tpl on custom_templates(workspace_id, kind, active);

alter table custom_templates enable row level security;
do $$ begin
  create policy ct_member on custom_templates for all using (is_member(workspace_id)) with check (is_member(workspace_id));
exception when duplicate_object then null; end $$;
