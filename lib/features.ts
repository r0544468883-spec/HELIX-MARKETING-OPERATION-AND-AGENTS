// Feature registry — every top-level capability in HELIX OPS is a "feature" with an
// on/off toggle. A workspace decides which features it uses via its `features` jsonb
// column (on the `workspaces` table); this drives BOTH the nav (which links appear)
// and route guarding (a disabled feature's page 404s). A missing setting falls back
// to the feature's `defaultOn`, so existing workspaces keep their current surface.
//
// Presets give a workspace a ready-made profile:
//   • 'full'             — the classic OPS suite (everything the workspace had before)
//   • 'performance-lean' — ONLY the performance module (the ads-scoring client): no
//                          post-writing, no requests/vault/brand/etc.
//
// This file is PURE (no server/Supabase imports) so it can be used on client & server.

export type FeatureId =
  | 'requests'
  | 'vault'
  | 'brand'
  | 'channels'
  | 'marketing'
  | 'campaigns'
  | 'landing'
  | 'templates'
  | 'coach'
  | 'performance';

export type Locale = 'he' | 'en';

export type FeatureDef = {
  id: FeatureId;
  /** Route under /[locale] (e.g. '/performance'). Also the nav href + guard key. */
  path: string;
  label: Record<Locale, string>;
  /** Value used when the workspace has no explicit setting for this feature. */
  defaultOn: boolean;
  /** Hide this link on small screens in the desktop nav (matches the old `hideSm`). */
  hideSm?: boolean;
};

// Order here IS the nav order.
export const FEATURES: FeatureDef[] = [
  { id: 'requests',   path: '/requests',    label: { he: 'בקשות',     en: 'Requests' },   defaultOn: true },
  { id: 'vault',      path: '/vault',       label: { he: 'כספת',      en: 'Vault' },      defaultOn: true, hideSm: true },
  { id: 'brand',      path: '/brand',       label: { he: 'מותג',      en: 'Brand' },      defaultOn: true, hideSm: true },
  { id: 'channels',   path: '/channels',    label: { he: 'ערוצים',    en: 'Channels' },   defaultOn: true, hideSm: true },
  { id: 'marketing',  path: '/attribution', label: { he: 'שיווק',     en: 'Marketing' },  defaultOn: true, hideSm: true },
  { id: 'campaigns',  path: '/campaigns',   label: { he: 'קמפיינים',  en: 'Campaigns' },  defaultOn: true, hideSm: true },
  { id: 'landing',    path: '/landing',     label: { he: 'דפי נחיתה', en: 'Landing' },    defaultOn: true, hideSm: true },
  { id: 'templates',  path: '/templates',   label: { he: 'תבניות',    en: 'Templates' },  defaultOn: true, hideSm: true },
  { id: 'coach',      path: '/coach',       label: { he: 'מאמן',      en: 'Coach' },      defaultOn: true, hideSm: true },
  // New module — OFF by default so existing workspaces don't suddenly see it.
  { id: 'performance', path: '/performance', label: { he: 'פרפורמנס', en: 'Performance' }, defaultOn: false, hideSm: true },
];

export const FEATURE_IDS = FEATURES.map((f) => f.id);

export type FeatureFlags = Partial<Record<FeatureId, boolean>>;

export type PresetId = 'full' | 'performance-lean';

/** Per-preset explicit flags. Anything omitted falls through to the feature default. */
export const PRESETS: Record<PresetId, FeatureFlags> = {
  full: Object.fromEntries(FEATURES.map((f) => [f.id, true])) as FeatureFlags,
  'performance-lean': {
    requests: false,
    vault: false,
    brand: false,
    channels: false,
    marketing: false,
    campaigns: false,
    landing: false,
    templates: false,
    coach: false,
    performance: true,
  },
};

/**
 * Shape stored in `workspaces.features` (jsonb). `preset` picks a base profile;
 * `flags` are per-feature overrides on top of it. Both optional — an empty/absent
 * value means "use every feature's defaultOn" (i.e. classic OPS untouched).
 */
export type StoredFeatures = {
  preset?: PresetId;
  flags?: FeatureFlags;
};

/**
 * Resolve the effective on/off map. Precedence (highest first):
 *   explicit flag  >  preset value  >  feature defaultOn
 */
export function resolveFeatures(stored?: StoredFeatures | null): Record<FeatureId, boolean> {
  const presetFlags = stored?.preset ? PRESETS[stored.preset] : undefined;
  const overrides = stored?.flags;
  const out = {} as Record<FeatureId, boolean>;
  for (const f of FEATURES) {
    out[f.id] = overrides?.[f.id] ?? presetFlags?.[f.id] ?? f.defaultOn;
  }
  return out;
}

/** Registry entries that are currently enabled, in nav order. */
export function enabledFeatures(stored?: StoredFeatures | null): FeatureDef[] {
  const map = resolveFeatures(stored);
  return FEATURES.filter((f) => map[f.id]);
}

/** True if a given feature is on for this stored config. */
export function isFeatureEnabled(id: FeatureId, stored?: StoredFeatures | null): boolean {
  return resolveFeatures(stored)[id];
}
