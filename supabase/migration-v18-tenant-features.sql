-- migration-v18 — Per-workspace feature toggles.
-- Every top-level HELIX OPS capability is a "feature" a workspace can turn on/off.
-- `features` mirrors lib/features.ts StoredFeatures: { preset?, flags? }.
--   • preset 'full'             — the classic OPS suite (default behaviour)
--   • preset 'performance-lean' — ONLY the performance module (ads-scoring client)
--   • flags {featureId: bool}   — per-feature overrides on top of the preset
-- Empty/absent → every feature falls back to its code-side defaultOn, so existing
-- workspaces are untouched until explicitly given a preset.

alter table workspaces
  add column if not exists features jsonb not null default '{}'::jsonb;

comment on column workspaces.features is
  'Feature toggles: { preset?: "full"|"performance-lean", flags?: {featureId: boolean} }. See lib/features.ts';

-- Example — set a specific workspace to the lean performance profile:
--   update workspaces set features = '{"preset":"performance-lean"}'::jsonb where id = '<workspace-uuid>';
-- Turn one extra feature back on for that workspace:
--   update workspaces set features = '{"preset":"performance-lean","flags":{"coach":true}}'::jsonb where id = '<workspace-uuid>';
