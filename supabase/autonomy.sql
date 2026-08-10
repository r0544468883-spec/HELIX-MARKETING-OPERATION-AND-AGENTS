-- HELIX Autonomy Switch — OPS install. See helix/PRODUCTS/AUTONOMY-SWITCH-SPEC.md.
-- Safe default: absent row => advisor. OPS already has execution controls
-- (performance_settings) and the engagement suggested→approved queue, so we add
-- only the canonical settings table and unify via lib/autonomy/resolve adapters.

create table if not exists autonomy_settings (
  workspace_id  uuid not null,
  feature_key   text not null,
  mode          text not null default 'advisor'
                check (mode in ('advisor','approve','autopilot')),
  risk_ack      boolean not null default false,
  daily_cap     int,
  updated_by    uuid,
  updated_at    timestamptz default now(),
  primary key (workspace_id, feature_key)
);

alter table autonomy_settings enable row level security;

do $$ begin
  create policy autonomy_member on autonomy_settings for all
    using (exists (select 1 from memberships m
                   where m.workspace_id = autonomy_settings.workspace_id
                     and m.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
