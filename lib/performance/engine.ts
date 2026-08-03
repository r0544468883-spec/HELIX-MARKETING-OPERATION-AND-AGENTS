import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  blendScore,
  computeBaseline,
  metricValue,
  type Metric,
  type CreativeMetrics,
  type ScoreBreakdown,
  ZERO_METRICS,
} from './scoring';
import { coldStartScore } from './cold-start';
import { getConnector, type AdRef, type ChannelConfig } from './connectors';

// The performance loop. Loads the creative pool + latest live metrics, scores every
// creative with the Bayesian blend (cold-start prior + client-baseline-normalized
// live data), turns scores into decisions per the workspace's thresholds, and —
// only in connector mode — applies them to the ad platform. In brain mode it records
// pending decisions for the operator to act on in their own tooling.

type DB = SupabaseClient;

export type PerfSettings = {
  metric: Metric;
  execution_mode: 'brain' | 'connector';
  autonomy: 'approve' | 'autopilot';
  pause_below: number;
  promote_above: number;
};

const DEFAULT_SETTINGS: PerfSettings = {
  metric: 'cpa',
  execution_mode: 'brain',
  autonomy: 'approve',
  pause_below: 35,
  promote_above: 70,
};

export type CreativeRow = {
  id: string;
  name: string;
  platform: string;
  format: string | null;
  headline: string | null;
  body: string | null;
  hook: string | null;
  media_url: string | null;
  external_ref: AdRef | null;
  status: 'draft' | 'live' | 'paused' | 'retired';
  cold_start: number | null;
  cold_reason: string | null;
};

export type ScoredCreative = {
  creative: CreativeRow;
  metrics: CreativeMetrics;
  score: ScoreBreakdown;
  action: DecisionAction;
  reason: string;
};

export type DecisionAction = 'pause' | 'scale_up' | 'scale_down' | 'promote' | 'keep';

export async function getSettings(db: DB, workspaceId: string): Promise<PerfSettings> {
  const { data } = await db
    .from('performance_settings')
    .select('metric, execution_mode, autonomy, pause_below, promote_above')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data as Partial<PerfSettings> | null) };
}

/** Latest metric snapshot per creative (one row per creative, newest as_of). */
async function latestMetrics(db: DB, creativeIds: string[]): Promise<Map<string, CreativeMetrics>> {
  const out = new Map<string, CreativeMetrics>();
  if (creativeIds.length === 0) return out;
  const { data } = await db
    .from('creative_metrics')
    .select('creative_id, spend, impressions, clicks, conversions, revenue, as_of')
    .in('creative_id', creativeIds)
    .order('as_of', { ascending: false });
  for (const r of (data ?? []) as (CreativeMetrics & { creative_id: string })[]) {
    if (out.has(r.creative_id)) continue; // first seen = newest (ordered desc)
    out.set(r.creative_id, {
      spend: Number(r.spend) || 0,
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      conversions: Number(r.conversions) || 0,
      revenue: Number(r.revenue) || 0,
    });
  }
  return out;
}

/** Decide an action from a blended score, gated by confidence so we never kill on noise. */
function decide(score: ScoreBreakdown, s: PerfSettings, status: CreativeRow['status']): { action: DecisionAction; reason: string } {
  // Confident enough to act on live data? (dataWeight ≥ 0.5 ≈ half the target sample.)
  const confident = score.confidence >= 0.5;
  if (status === 'draft') {
    return score.coldStart >= s.promote_above
      ? { action: 'promote', reason: `AI prior ${score.coldStart} ≥ ${s.promote_above} — launch from pool` }
      : { action: 'keep', reason: `AI prior ${score.coldStart} — hold in pool` };
  }
  if (score.blended <= s.pause_below && confident) {
    return { action: 'pause', reason: `score ${Math.round(score.blended)} ≤ ${s.pause_below} at ${(score.confidence * 100) | 0}% confidence — pause` };
  }
  if (score.blended >= s.promote_above && confident) {
    return { action: 'scale_up', reason: `score ${Math.round(score.blended)} ≥ ${s.promote_above} — winner, scale budget` };
  }
  return { action: 'keep', reason: `score ${Math.round(score.blended)} — keep, still learning (${(score.confidence * 100) | 0}%)` };
}

/**
 * Score every non-retired creative in the workspace and return the ranked result.
 * Caches the AI cold-start on first compute. Does NOT persist decisions — call
 * runWorkspace() for the full loop (score → decide → record → maybe apply).
 */
export async function scoreWorkspace(db: DB, workspaceId: string): Promise<{ settings: PerfSettings; scored: ScoredCreative[] }> {
  const settings = await getSettings(db, workspaceId);
  const { data: creativesData } = await db
    .from('creatives')
    .select('id, name, platform, format, headline, body, hook, media_url, external_ref, status, cold_start, cold_reason')
    .eq('workspace_id', workspaceId)
    .neq('status', 'retired');
  const creatives = (creativesData ?? []) as CreativeRow[];

  const metricsById = await latestMetrics(db, creatives.map((c) => c.id));

  // Baseline = distribution of the chosen metric across THIS client's creatives that
  // already have a computable value. Scoring is relative to the client's own norm.
  const baselineValues: number[] = [];
  for (const c of creatives) {
    const v = metricValue(settings.metric, metricsById.get(c.id) ?? ZERO_METRICS);
    if (v !== null) baselineValues.push(v);
  }
  const baseline = computeBaseline(baselineValues);

  const scored: ScoredCreative[] = [];
  for (const c of creatives) {
    // Cold-start: use cache; compute + persist on first sight.
    let cold = c.cold_start;
    let coldReason = c.cold_reason ?? '';
    if (cold === null || cold === undefined) {
      const r = await coldStartScore(
        { platform: c.platform, format: c.format ?? undefined, headline: c.headline ?? undefined, body: c.body ?? undefined, hook: c.hook ?? undefined, mediaUrl: c.media_url ?? undefined },
        settings.metric
      );
      cold = r.score;
      coldReason = r.reasoning;
      await db.from('creatives').update({ cold_start: cold, cold_reason: coldReason, updated_at: new Date().toISOString() }).eq('id', c.id);
    }

    const metrics = metricsById.get(c.id) ?? ZERO_METRICS;
    const score = blendScore(settings.metric, cold, metrics, baseline);
    const { action, reason } = decide(score, settings, c.status);
    scored.push({ creative: { ...c, cold_start: cold, cold_reason: coldReason }, metrics, score, action, reason });
  }

  // Rank best-first by blended score.
  scored.sort((a, b) => b.score.blended - a.score.blended);
  return { settings, scored };
}

/**
 * Connector-mode launch: upload a pool creative to its platform and persist the
 * returned platform ids on external_ref (so later pause/scale/insights can target it).
 * No-op success in brain mode or when unconfigured — going live shouldn't be blocked
 * by connectivity the client may handle on their own side. Returns whether an upload
 * actually happened.
 */
export async function launchCreativeOnPlatform(db: DB, workspaceId: string, creativeId: string): Promise<boolean> {
  const settings = await getSettings(db, workspaceId);
  if (settings.execution_mode !== 'connector') return false;

  const { data: c } = await db
    .from('creatives')
    .select('id, name, platform, headline, body, media_url, external_ref')
    .eq('id', creativeId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!c) return false;
  const conn = getConnector(c.platform as string);
  if (!conn) return false;
  // Already uploaded? don't duplicate.
  const ref = (c.external_ref as AdRef) ?? {};
  if (ref.adId || ref.promotedLinkId) return false;

  const { data: cc } = await db.from('channel_connections').select('config').eq('workspace_id', workspaceId).eq('channel', c.platform).maybeSingle();
  if (!cc?.config) return false;

  const res = await conn.uploadCreative(cc.config as ChannelConfig, {
    name: c.name as string,
    platform: c.platform as string,
    headline: (c.headline as string) ?? undefined,
    body: (c.body as string) ?? undefined,
    mediaUrl: (c.media_url as string) ?? undefined,
  });
  if (!res.ok) return false;
  await db.from('creatives').update({ external_ref: { ...ref, ...(res.ref ?? {}) }, updated_at: new Date().toISOString() }).eq('id', creativeId);
  return true;
}

/**
 * Connector-mode data pull: for every creative with a supported connector + channel
 * config, read live stats through the platform API and store a fresh metrics snapshot.
 * In brain mode the client pushes metrics to /api/performance/metrics instead. Returns
 * how many creatives got a fresh snapshot.
 */
export async function pullConnectorMetrics(db: DB, workspaceId: string): Promise<number> {
  const { data } = await db
    .from('creatives')
    .select('id, platform, external_ref')
    .eq('workspace_id', workspaceId)
    .neq('status', 'retired');
  const creatives = (data ?? []) as { id: string; platform: string; external_ref: AdRef | null }[];

  const configCache = new Map<string, ChannelConfig | null>();
  const getConfig = async (platform: string): Promise<ChannelConfig | null> => {
    if (configCache.has(platform)) return configCache.get(platform)!;
    const { data: c } = await db.from('channel_connections').select('config').eq('workspace_id', workspaceId).eq('channel', platform).maybeSingle();
    const cfg = (c?.config as ChannelConfig) ?? null;
    configCache.set(platform, cfg);
    return cfg;
  };

  let n = 0;
  for (const c of creatives) {
    const conn = getConnector(c.platform);
    if (!conn) continue;
    const cfg = await getConfig(c.platform);
    if (!cfg) continue;
    const ins = await conn.fetchInsights(cfg, c.external_ref ?? {});
    if (!ins) continue;
    await db.from('creative_metrics').insert({
      workspace_id: workspaceId,
      creative_id: c.id,
      platform: c.platform,
      spend: ins.spend ?? 0,
      impressions: ins.impressions,
      clicks: ins.clicks,
      conversions: ins.conversions ?? 0,
      revenue: ins.revenue ?? 0,
    });
    n++;
  }
  return n;
}

/**
 * Full loop: (connector mode) pull fresh metrics → score → record actionable decisions.
 * In connector + autopilot it also applies pause/scale to the ad platform. In brain
 * mode, or connector+approve, decisions are left 'pending' for a human. Returns a summary.
 */
export async function runWorkspace(db: DB, workspaceId: string): Promise<{ scored: ScoredCreative[]; recorded: number; applied: number }> {
  // Auto-pull live stats through connectors before scoring (connector mode only).
  const pre = await getSettings(db, workspaceId);
  if (pre.execution_mode === 'connector') await pullConnectorMetrics(db, workspaceId);

  const { settings, scored } = await scoreWorkspace(db, workspaceId);
  const autopilot = settings.execution_mode === 'connector' && settings.autonomy === 'autopilot';

  let recorded = 0;
  let applied = 0;

  // Channel config for connector actions (Meta only for now), keyed by platform label.
  const configCache = new Map<string, ChannelConfig | null>();
  const getConfig = async (platform: string): Promise<ChannelConfig | null> => {
    if (configCache.has(platform)) return configCache.get(platform)!;
    const { data } = await db.from('channel_connections').select('config').eq('workspace_id', workspaceId).eq('channel', platform).maybeSingle();
    const cfg = (data?.config as ChannelConfig) ?? null;
    configCache.set(platform, cfg);
    return cfg;
  };

  for (const s of scored) {
    if (s.action === 'keep') continue; // nothing to record for steady state

    const willApply = autopilot && (s.action === 'pause' || s.action === 'scale_up');
    let status: 'pending' | 'applied' = 'pending';

    if (willApply) {
      const cfg = await getConfig(s.creative.platform);
      const conn = getConnector(s.creative.platform);
      const ref = s.creative.external_ref ?? {};
      if (cfg && conn && s.action === 'pause') {
        if (await conn.pauseAd(cfg, ref)) {
          await db.from('creatives').update({ status: 'paused' }).eq('id', s.creative.id);
          status = 'applied';
          applied++;
        }
      } else if (cfg && conn && s.action === 'scale_up' && ref.dailyBudget) {
        // Scale the winner +25% off its last-known daily budget. If we don't have a
        // budget on the ref, we leave it pending (a human sets/approves) rather than guess.
        if (await conn.setBudget(cfg, ref, Math.round(ref.dailyBudget * 1.25))) {
          status = 'applied';
          applied++;
        }
      }
    }

    await db.from('performance_decisions').insert({
      workspace_id: workspaceId,
      creative_id: s.creative.id,
      action: s.action,
      reason: s.reason,
      score: Math.round(s.score.blended),
      confidence: s.score.confidence,
      status,
      applied_at: status === 'applied' ? new Date().toISOString() : null,
    });
    recorded++;
  }

  return { scored, recorded, applied };
}
