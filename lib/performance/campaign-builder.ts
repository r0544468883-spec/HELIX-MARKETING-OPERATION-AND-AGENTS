import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { askJson } from './llm';
import { getConnector, type CampaignSpec, type CampaignObjective, type ChannelConfig, type CampaignResult } from './connectors';
import { getStyleProfile, applyStyle, type StyleProfile } from './style-profile';

// AI campaign builder — the "create a campaign in under a minute" piece. Turns a short
// brief (product, goal, budget, audience hint) into a full CampaignSpec: audiences +
// A/B creative variants, written in the operator's own style (naming, budget, targeting
// from the learned style profile). Then hands the spec to the platform connector to build
// the whole hierarchy PAUSED. The generated creatives are also inserted into the pool so
// the Bayesian score loop tracks them from day one.

type DB = SupabaseClient;

export type CampaignBrief = {
  platform: string; // 'Meta' | 'TikTok' | 'Google' | 'Outbrain'
  product: string; // what's being advertised
  goal?: string; // free text ("book demos", "sell course")
  objective?: CampaignObjective;
  dailyBudget?: number; // ₪ — falls back to style default
  audienceHint?: string; // "SMB owners 30-50 in Israel"
  link?: string;
  variants?: number; // how many creative variants (default 3)
  brand?: string; // brand token for naming
};

type Generated = {
  name?: string;
  audiences?: { name: string; countries?: string[]; ageMin?: number; ageMax?: number; interests?: string[] }[];
  creatives?: { name?: string; headline?: string; body?: string }[];
};

function yymm(): string {
  const d = new Date();
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Generate a CampaignSpec from a brief, styled to the workspace. Pure of DB writes. */
export async function buildSpec(brief: CampaignBrief, style: StyleProfile): Promise<CampaignSpec> {
  const variants = Math.min(5, Math.max(1, brief.variants ?? 3));
  const objective = brief.objective ?? 'traffic';

  const gen = await askJson<Generated>(
    'You are a senior performance marketer. Design a paid campaign for the given platform and goal. ' +
      `Return ONLY strict JSON: {"audiences":[{"name","countries":["IL"],"ageMin","ageMax","interests":[]}...], ` +
      `"creatives":[{"name","headline","body"}... exactly ${variants} distinct A/B variants]}. ` +
      'Creatives must be in the SAME language as the product/goal text (Hebrew if Hebrew). ' +
      'Give 1-3 audiences. Keep headlines tight, bodies 1-2 sentences with a clear CTA. No prose outside JSON.',
    [
      {
        type: 'text',
        text: [
          `Platform: ${brief.platform}`,
          `Objective: ${objective}`,
          `Product: ${brief.product}`,
          brief.goal && `Goal: ${brief.goal}`,
          brief.audienceHint && `Audience hint: ${brief.audienceHint}`,
          style.preferences.length && `Honor these operator preferences: ${style.preferences.join('; ')}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    1200
  );

  // Fallback content if AI is unavailable — one neutral audience + one creative from the brief.
  const rawAudiences =
    gen?.audiences?.length
      ? gen.audiences
      : [{ name: brief.audienceHint?.slice(0, 30) || 'all', countries: style.defaultCountries, ageMin: style.ageMin, ageMax: style.ageMax }];
  const rawCreatives =
    gen?.creatives?.length
      ? gen.creatives.slice(0, variants)
      : Array.from({ length: variants }, (_, i) => ({ name: `${brief.product} #${i + 1}`, headline: brief.product, body: brief.goal || brief.product }));

  const spec: CampaignSpec = {
    name: gen?.name || '',
    objective,
    dailyBudget: brief.dailyBudget || style.defaultDailyBudget,
    link: brief.link,
    audiences: rawAudiences.map((a) => ({
      name: a.name,
      countries: a.countries,
      ageMin: a.ageMin,
      ageMax: a.ageMax,
      interests: a.interests,
    })),
    creatives: rawCreatives.map((c) => ({ name: c.name, headline: c.headline, body: c.body })),
  };

  return applyStyle(spec, style, brief.brand || 'HELIX', yymm());
}

export type BuildAndLaunchResult = {
  ok: boolean;
  spec: CampaignSpec;
  created?: CampaignResult;
  creativeIds: string[];
  error?: string;
  note?: string;
};

/**
 * Full flow: learn-style → generate spec → seed the creative pool → (connector mode)
 * build the campaign on the platform. In brain mode we still generate + seed the pool
 * (so the operator gets the plan + creatives to launch themselves), but skip the API call.
 */
export async function buildAndLaunch(db: DB, workspaceId: string, brief: CampaignBrief): Promise<BuildAndLaunchResult> {
  const style = await getStyleProfile(db, workspaceId);
  const spec = await buildSpec(brief, style);

  // Seed the generated variants into the creative pool as drafts (enter the score loop).
  const creativeIds: string[] = [];
  for (const c of spec.creatives) {
    const { data } = await db
      .from('creatives')
      .insert({
        workspace_id: workspaceId,
        name: c.name || spec.name,
        platform: brief.platform,
        format: 'text',
        headline: c.headline ?? null,
        body: c.body ?? null,
        status: 'draft',
        external_ref: {},
      })
      .select('id')
      .maybeSingle();
    if (data?.id) creativeIds.push(data.id as string);
  }

  // Execution mode gates the actual platform call.
  const { data: settings } = await db.from('performance_settings').select('execution_mode').eq('workspace_id', workspaceId).maybeSingle();
  if (settings?.execution_mode !== 'connector') {
    return { ok: true, spec, creativeIds, note: 'brain_mode: plan + pool created; no platform call' };
  }

  const conn = getConnector(brief.platform);
  if (!conn) return { ok: true, spec, creativeIds, note: 'no_connector_for_platform' };
  const { data: cc } = await db.from('channel_connections').select('config').eq('workspace_id', workspaceId).eq('channel', brief.platform).maybeSingle();
  if (!cc?.config) return { ok: true, spec, creativeIds, note: 'no_channel_config' };

  const created = await conn.createCampaign(cc.config as ChannelConfig, spec);
  // Stamp the new campaign id onto the seeded creatives so later actions can target it.
  if (created.ok && created.campaignId && creativeIds.length) {
    await db.from('creatives').update({ external_ref: { campaignId: created.campaignId } }).in('id', creativeIds);
  }
  return { ok: created.ok, spec, created, creativeIds, error: created.error, note: created.note };
}
