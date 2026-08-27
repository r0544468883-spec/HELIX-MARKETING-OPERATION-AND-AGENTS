import type { AdConnector, ChannelConfig, InsightRow, AdRef } from './types';
import { cfg, jsonFetch } from './types';

// Google Display & Video 360 (DV360) — the programmatic DSP. Unlike the self-serve
// platforms, DV360 is how HELIX reaches PREMIUM PUBLISHER inventory (incl. Israeli news
// sites: Ynet, Walla, Sport5) automatically, via a negotiated Deal ID (PMP / Programmatic
// Guaranteed / Preferred) instead of a manual insertion order.
//
// IMPORTANT — the operator MUST have a DV360 seat first. DV360 is not open self-serve; it
// is provisioned through a Google-certified partner. Until an advertiser is connected the
// connector degrades cleanly (false/null), exactly like every other connector.
//
// Two Google APIs are involved (both OAuth2 Bearer, dep-free via jsonFetch to match the
// other connectors — we mirror the official @googleapis/displayvideo + Bid Manager shapes
// rather than pulling the heavy client lib into the serverless bundle):
//   • Display & Video 360 API (displayvideo.googleapis.com/v3) — pause / budget on line items.
//   • Bid Manager API (doubleclickbidmanager.googleapis.com/v2) — reporting (fetchInsights).
//
// config: { access_token, advertiser_id, partner_id?, report_query_id? }.
// Env fallback: DV360_ACCESS_TOKEN, DV360_ADVERTISER_ID, DV360_PARTNER_ID, DV360_REPORT_QUERY_ID.
// We act at the LINE ITEM level (ref.adId = lineItemId).
const DV = 'https://displayvideo.googleapis.com/v3';
const BM = 'https://doubleclickbidmanager.googleapis.com/v2';

function token(config: ChannelConfig): string | undefined {
  return cfg(config, 'access_token', 'DV360_ACCESS_TOKEN');
}
function advertiser(config: ChannelConfig): string | undefined {
  return cfg(config, 'advertiser_id', 'DV360_ADVERTISER_ID');
}

// ── Bid Manager CSV → totals. DV360 reports are CSV: a header row, data rows, then a blank
//    line before the grand-total/footer. We sum the data rows (optionally filtered to one
//    line item) and map the standard column names to our normalized InsightRow. Best-effort,
//    tolerant of column-order changes; unknown columns are ignored.
function num(s: string | undefined): number {
  const n = Number((s ?? '').replace(/[",]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function findCol(header: string[], ...patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = header.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}
function parseBidManagerCsv(csv: string, ref: AdRef): InsightRow | null {
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const iLineItem = findCol(header, /line\s*item\s*id/i);
  const iImpr = findCol(header, /impressions/i);
  const iClicks = findCol(header, /clicks/i);
  const iSpend = findCol(header, /revenue.*adv|media\s*cost.*adv|total\s*media\s*cost/i);
  const iConv = findCol(header, /total\s*conversions|conversions/i);
  if (iImpr < 0 && iClicks < 0) return null; // not a stats report

  const out: InsightRow = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };
  let matched = 0;
  for (let r = 1; r < lines.length; r++) {
    const raw = lines[r];
    if (!raw || !raw.trim()) break; // blank line = end of data, footer follows
    const cols = raw.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    // If we know the line item and the report carries it, sum only that line item's rows.
    if (ref.adId && iLineItem >= 0 && cols[iLineItem] && cols[iLineItem] !== ref.adId) continue;
    out.impressions += iImpr >= 0 ? num(cols[iImpr]) : 0;
    out.clicks += iClicks >= 0 ? num(cols[iClicks]) : 0;
    out.spend = (out.spend ?? 0) + (iSpend >= 0 ? num(cols[iSpend]) : 0);
    out.conversions = (out.conversions ?? 0) + (iConv >= 0 ? num(cols[iConv]) : 0);
    matched++;
  }
  return matched ? out : null;
}

export const dv360Connector: AdConnector = {
  platform: 'DV360',

  async pauseAd(config, ref) {
    const t = token(config);
    const adv = advertiser(config);
    const lineItemId = ref.adId ?? ref.campaignId;
    if (!t || !adv || !lineItemId) return false;
    const { ok } = await jsonFetch(
      `${DV}/advertisers/${adv}/lineItems/${lineItemId}?updateMask=entityStatus`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
        body: JSON.stringify({ entityStatus: 'ENTITY_STATUS_PAUSED' }),
      },
    );
    return ok;
  },

  async setBudget(config, ref, daily) {
    const t = token(config);
    const adv = advertiser(config);
    const lineItemId = ref.adId ?? ref.campaignId;
    if (!t || !adv || !lineItemId) return false;
    // DV360 budgets are in micros of the advertiser currency.
    const micros = Math.round(daily * 1_000_000);
    const { ok } = await jsonFetch(
      `${DV}/advertisers/${adv}/lineItems/${lineItemId}?updateMask=budget.maxAmount`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
        body: JSON.stringify({ budget: { maxAmount: String(micros) } }),
      },
    );
    return ok;
  },

  async uploadCreative(_config, _c) {
    // DV360 creatives are managed centrally (or served from the exchange via the deal).
    // Not part of the automated pool flow — surfaced as unsupported so the engine skips it.
    return { ok: false, error: 'dv360_creative_upload_unsupported' };
  },

  async fetchInsights(config, ref) {
    // Live stats via the Bid Manager API: fetch the latest FINISHED report for a stored
    // query (report_query_id, created once in DV360/Bid Manager), download the CSV, and sum.
    // Returns null (degrades cleanly) when not configured or no report is ready yet.
    const t = token(config);
    const queryId = cfg(config, 'report_query_id', 'DV360_REPORT_QUERY_ID');
    if (!t || !queryId) return null;
    const { ok, json } = await jsonFetch(`${BM}/queries/${queryId}/reports?pageSize=10`, {
      method: 'GET',
      headers: { authorization: `Bearer ${t}` },
    });
    if (!ok) return null;
    const reports = (json.reports as Record<string, unknown>[] | undefined) ?? [];
    const done = reports
      .map((r) => r.metadata as { status?: { state?: string }; googleCloudStoragePath?: string } | undefined)
      .filter((m): m is { status: { state: string }; googleCloudStoragePath: string } =>
        !!m && m.status?.state === 'DONE' && !!m.googleCloudStoragePath,
      );
    if (!done.length) return null;
    const path = done[done.length - 1].googleCloudStoragePath; // most recent finished run
    let csv = '';
    try {
      const res = await fetch(path); // the storage path is a signed URL — no auth header
      if (!res.ok) return null;
      csv = await res.text();
    } catch {
      return null;
    }
    return parseBidManagerCsv(csv, ref);
  },

  async createCampaign(_config, _spec) {
    // A DV360 buy is not created from a spec like a self-serve campaign — it activates a
    // negotiated Deal ID (PMP / Programmatic Guaranteed / Preferred) against publisher
    // inventory. That flow lives in the Managed pipeline (publisher_deals → Deal ID), not here.
    return {
      ok: false,
      error: 'dv360_requires_deal',
      note: 'DV360: buys run against a negotiated Deal ID from the publisher, not a self-serve spec. Connect a DV360 seat and attach the Deal ID in the media buy.',
    };
  },
};
