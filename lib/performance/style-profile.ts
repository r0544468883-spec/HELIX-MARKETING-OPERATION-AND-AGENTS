import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { askJson } from './llm';
import type { CampaignSpec, CampaignAudience } from './connectors';

// Style-learning agent — the "learns your work style" piece (naming conventions, budget
// allocation, client preferences). It reads the workspace's OWN past campaigns/creatives
// and infers HOW this operator names and structures things, then applies that style to
// every new campaign the builder produces — so output looks like the client made it, not
// a generic template. Stored per-workspace in `performance_style`; degrades to sane
// defaults when there's no history or no AI key.

type DB = SupabaseClient;

export type StyleProfile = {
  /** e.g. "{brand}_{objective}_{MMYY}" — tokens: brand, objective, audience, date, n */
  namingPattern: string;
  /** free-text description of how budget is split (e.g. "60% winners, test 3 new/wk") */
  budgetStrategy: string;
  /** default daily budget the operator tends to start a campaign at (₪) */
  defaultDailyBudget: number;
  /** default countries + age range the operator targets */
  defaultCountries: string[];
  ageMin: number;
  ageMax: number;
  /** anything else worth honoring (tone, emoji use, UTM habits…) */
  preferences: string[];
};

export const DEFAULT_STYLE: StyleProfile = {
  namingPattern: '{brand}_{objective}_{date}',
  budgetStrategy: 'Start even across audiences; scale winners +25%, pause losers under threshold.',
  defaultDailyBudget: 100,
  defaultCountries: ['IL'],
  ageMin: 18,
  ageMax: 65,
  preferences: [],
};

/** Read the learned style for a workspace, or defaults if none learned yet. */
export async function getStyleProfile(db: DB, workspaceId: string): Promise<StyleProfile> {
  const { data } = await db
    .from('performance_style')
    .select('naming_pattern, budget_strategy, default_daily_budget, default_countries, age_min, age_max, preferences')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!data) return DEFAULT_STYLE;
  return {
    namingPattern: (data.naming_pattern as string) || DEFAULT_STYLE.namingPattern,
    budgetStrategy: (data.budget_strategy as string) || DEFAULT_STYLE.budgetStrategy,
    defaultDailyBudget: Number(data.default_daily_budget) || DEFAULT_STYLE.defaultDailyBudget,
    defaultCountries: (data.default_countries as string[])?.length ? (data.default_countries as string[]) : DEFAULT_STYLE.defaultCountries,
    ageMin: Number(data.age_min) || DEFAULT_STYLE.ageMin,
    ageMax: Number(data.age_max) || DEFAULT_STYLE.ageMax,
    preferences: (data.preferences as string[]) ?? [],
  };
}

/**
 * Learn (or re-learn) the workspace's style from its own history: existing creative
 * names + any past campaign names + recent budgets. Sends the sample to Claude to infer
 * the naming pattern, budget habits and preferences, then persists. Returns the profile
 * (falls back to whatever we had / defaults if there's no history or no AI).
 */
export async function learnStyleProfile(db: DB, workspaceId: string): Promise<StyleProfile> {
  // Sample the operator's own artifacts.
  const { data: creatives } = await db
    .from('creatives')
    .select('name, platform, headline')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(40);
  // campaigns table may not exist in a performance-lean install — on error, data is null.
  const { data: campaigns } = await db
    .from('campaigns')
    .select('name')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(40);

  const names = [
    ...((campaigns ?? []) as { name: string }[]).map((c) => c.name),
    ...((creatives ?? []) as { name: string }[]).map((c) => c.name),
  ].filter(Boolean);

  const current = await getStyleProfile(db, workspaceId);
  if (names.length < 3) return current; // not enough signal — keep current/defaults

  const inferred = await askJson<Partial<StyleProfile>>(
    'You are a performance-marketing ops analyst. Given a marketer\'s own past campaign/creative NAMES, infer their conventions. ' +
      'Return ONLY strict JSON with keys: namingPattern (a template using tokens {brand},{objective},{audience},{date},{n}), ' +
      'budgetStrategy (one sentence), defaultDailyBudget (integer ₪), defaultCountries (array of ISO-2), ageMin, ageMax, ' +
      'preferences (array of short strings: tone, emoji, UTM habits…). Infer only what the names support; keep sensible defaults otherwise.',
    `Names (newest first):\n${names.slice(0, 60).join('\n')}`,
    700
  );

  const merged: StyleProfile = {
    namingPattern: inferred?.namingPattern || current.namingPattern,
    budgetStrategy: inferred?.budgetStrategy || current.budgetStrategy,
    defaultDailyBudget: Number(inferred?.defaultDailyBudget) || current.defaultDailyBudget,
    defaultCountries: inferred?.defaultCountries?.length ? inferred.defaultCountries : current.defaultCountries,
    ageMin: Number(inferred?.ageMin) || current.ageMin,
    ageMax: Number(inferred?.ageMax) || current.ageMax,
    preferences: inferred?.preferences?.length ? inferred.preferences : current.preferences,
  };

  await db.from('performance_style').upsert(
    {
      workspace_id: workspaceId,
      naming_pattern: merged.namingPattern,
      budget_strategy: merged.budgetStrategy,
      default_daily_budget: merged.defaultDailyBudget,
      default_countries: merged.defaultCountries,
      age_min: merged.ageMin,
      age_max: merged.ageMax,
      preferences: merged.preferences,
      learned_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' }
  );
  return merged;
}

/** Render the naming pattern for a concrete campaign. `date` = current YYMM-ish token. */
export function renderName(pattern: string, tokens: { brand?: string; objective?: string; audience?: string; date?: string; n?: number }): string {
  return pattern
    .replace(/\{brand\}/gi, tokens.brand || 'HELIX')
    .replace(/\{objective\}/gi, tokens.objective || 'traffic')
    .replace(/\{audience\}/gi, tokens.audience || 'all')
    .replace(/\{date\}/gi, tokens.date || '')
    .replace(/\{n\}/gi, String(tokens.n ?? 1))
    .replace(/_+$/, '')
    .trim();
}

/**
 * Apply the learned style to a builder spec: fill missing budget/targeting from the
 * profile and rewrite the campaign + audience names to match the operator's convention.
 */
export function applyStyle(spec: CampaignSpec, style: StyleProfile, brand: string, dateToken: string): CampaignSpec {
  const objective = spec.objective ?? 'traffic';
  const campaignName = renderName(style.namingPattern, { brand, objective, date: dateToken });
  return {
    ...spec,
    name: spec.name?.trim() || campaignName,
    dailyBudget: spec.dailyBudget || style.defaultDailyBudget,
    audiences: (spec.audiences.length ? spec.audiences : ([{ name: 'all' }] as CampaignAudience[])).map((a: CampaignAudience, i: number) => ({
      name: a.name || `aud${i + 1}`,
      countries: a.countries?.length ? a.countries : style.defaultCountries,
      ageMin: a.ageMin ?? style.ageMin,
      ageMax: a.ageMax ?? style.ageMax,
      interests: a.interests,
    })),
  };
}
