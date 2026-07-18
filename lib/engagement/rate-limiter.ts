// Safety layer — keeps engagement "under the radar":
// per-channel daily caps, warm-up ramp, min-gap + jitter, risk meter, kill-switch.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngagementLimit, RiskLevel } from './types';

// Conservative daily ceilings (heuristics, not guarantees). Gray channels are lowest.
const DEFAULT_CAPS: Record<string, number> = {
  לינקדאין: 15,
  אינסטגרם: 20,
  פייסבוק: 20,
  X: 50,
  Reddit: 20,
  Bluesky: 50,
  Mastodon: 50,
  Nostr: 50,
  טלגרם: 50,
  Discord: 50,
  Slack: 50,
};

// Minimum spacing between actions per channel (ms). Gray channels are slowest.
const MIN_GAP_MS: Record<string, number> = {
  לינקדאין: 15 * 60_000,
  אינסטגרם: 6 * 60_000,
  פייסבוק: 6 * 60_000,
};
const DEFAULT_GAP_MS = 60_000;

// Warm-up ramp: new accounts start low and climb over stages.
const WARMUP_RAMP = [5, 8, 12];

export function defaultCap(channel: string): number {
  return DEFAULT_CAPS[channel] ?? 15;
}

export function minGapMs(channel: string): number {
  return MIN_GAP_MS[channel] ?? DEFAULT_GAP_MS;
}

// Effective cap = min(configured cap, warm-up ceiling for the current stage).
export function effectiveCap(row: Pick<EngagementLimit, 'daily_cap' | 'warmup_stage'>): number {
  const ramp = WARMUP_RAMP[row.warmup_stage - 1] ?? row.daily_cap;
  return Math.min(row.daily_cap, ramp);
}

export function computeRisk(used: number, cap: number): RiskLevel {
  if (cap <= 0) return 'red';
  const r = used / cap;
  if (r >= 0.9) return 'red';
  if (r >= 0.6) return 'amber';
  return 'green';
}

// Add human jitter on top of the min gap (0–40% extra).
export function jitteredGapMs(channel: string): number {
  return Math.round(minGapMs(channel) * (1 + Math.random() * 0.4));
}

// Fetch (or create) the limit row, resetting the daily counter on a new day.
export async function ensureLimit(
  admin: SupabaseClient,
  workspaceId: string,
  channel: string
): Promise<EngagementLimit> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from('engagement_limits')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('channel', channel)
    .maybeSingle();

  if (!data) {
    const insert = {
      workspace_id: workspaceId,
      channel,
      daily_cap: defaultCap(channel),
      used_today: 0,
      used_date: today,
      warmup_stage: 1,
      risk_level: 'green' as RiskLevel,
      paused: false,
    };
    const { data: created } = await admin
      .from('engagement_limits')
      .insert(insert)
      .select('*')
      .single();
    return created as EngagementLimit;
  }

  const row = data as EngagementLimit;
  if (row.used_date !== today) {
    const { data: reset } = await admin
      .from('engagement_limits')
      .update({ used_today: 0, used_date: today, risk_level: 'green' })
      .eq('id', row.id)
      .select('*')
      .single();
    return reset as EngagementLimit;
  }
  return row;
}

export type ActDecision = { ok: boolean; reason?: string };

// Can we act right now on this channel?
export function canAct(row: EngagementLimit): ActDecision {
  if (row.paused) return { ok: false, reason: 'paused' };
  const cap = effectiveCap(row);
  if (row.used_today >= cap) return { ok: false, reason: 'daily_cap_reached' };
  if (row.last_action_at) {
    const elapsed = Date.now() - new Date(row.last_action_at).getTime();
    if (elapsed < minGapMs(row.channel)) return { ok: false, reason: 'min_gap' };
  }
  return { ok: true };
}

// Record a successful action: bump the counter + recompute risk.
export async function recordAction(admin: SupabaseClient, row: EngagementLimit): Promise<void> {
  const used = row.used_today + 1;
  await admin
    .from('engagement_limits')
    .update({
      used_today: used,
      last_action_at: new Date().toISOString(),
      risk_level: computeRisk(used, effectiveCap(row)),
    })
    .eq('id', row.id);
}

// Kill-switch: pause/resume a channel (or all channels for a workspace).
export async function setPaused(
  admin: SupabaseClient,
  workspaceId: string,
  channel: string | null,
  paused: boolean
): Promise<void> {
  let q = admin.from('engagement_limits').update({ paused }).eq('workspace_id', workspaceId);
  if (channel) q = q.eq('channel', channel);
  await q;
}
