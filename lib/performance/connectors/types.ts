import type { ChannelConfig } from '../../distribution/types';

export type { ChannelConfig };

// One uniform interface every ad platform implements, so the performance engine can
// pause / re-budget / upload / read stats WITHOUT knowing which platform it is. Each
// connector reads its own creds from the workspace's channel_connections.config
// (with env fallback), and degrades cleanly (false/null) when not configured — the
// engine treats "couldn't act" the same everywhere.

/** Platform ids we persist on a creative so a connector can act on it. Superset — each
 *  connector uses the fields it needs (Meta: adId/adsetId; Google: adGroupId/adId;
 *  TikTok: adId/adGroupId; Outbrain: promotedLinkId/campaignId/budgetId). */
export type AdRef = {
  adId?: string;
  adsetId?: string; // Meta ad set
  adGroupId?: string; // TikTok / Google ad group
  campaignId?: string;
  budgetId?: string; // Outbrain budget / Google campaignBudget resource
  promotedLinkId?: string; // Outbrain creative
  dailyBudget?: number; // last-known daily budget (major units) — enables +% scaling
};

export type CreativeUpload = {
  name: string;
  platform: string;
  headline?: string;
  body?: string;
  mediaUrl?: string;
  link?: string;
};

export type UploadResult = { ok: boolean; externalId?: string; ref?: AdRef; error?: string };

/** Normalized stats. Not every platform returns every field; missing → undefined. */
export type InsightRow = {
  impressions: number;
  clicks: number;
  spend?: number;
  conversions?: number;
  revenue?: number;
};

export interface AdConnector {
  platform: string;
  /** Pause a single ad/promoted link. true = paused. */
  pauseAd(config: ChannelConfig, ref: AdRef): Promise<boolean>;
  /** Set the daily budget (major units, e.g. ₪) of the ad set/campaign. true = applied. */
  setBudget(config: ChannelConfig, ref: AdRef, dailyBudgetMajor: number): Promise<boolean>;
  /** Upload a creative from the pool to the platform. Returns platform ids to persist. */
  uploadCreative(config: ChannelConfig, c: CreativeUpload): Promise<UploadResult>;
  /** Read live stats for a creative. null = not available / not configured. */
  fetchInsights(config: ChannelConfig, ref: AdRef): Promise<InsightRow | null>;
}

// ── shared helpers for the connectors ──
export function cfg(config: ChannelConfig, key: string, envKey?: string): string | undefined {
  const v = config?.[key];
  if (typeof v === 'string' && v) return v;
  return envKey ? process.env[envKey] : undefined;
}

export async function jsonFetch(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, init);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: {} };
  }
}
