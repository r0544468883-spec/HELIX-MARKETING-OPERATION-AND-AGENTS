import type { AdConnector, ChannelConfig, InsightRow } from './types';
import { cfg, jsonFetch } from './types';

// LinkedIn Marketing API (Sponsored Content). Bearer OAuth token + versioned header.
// config: { access_token, account_id, currency? }.
// Restli 2.0: updates are PARTIAL_UPDATE (POST + X-RestLi-Method header + {patch:{$set}}).
// Pause = status:PAUSED; budget = dailyBudget; stats = /adAnalytics; create = /adCampaigns.
// Creative upload needs a sponsored post first, so it's best-effort with an honest note.
const BASE = 'https://api.linkedin.com/rest';
const VERSION = '202401'; // LinkedIn-Version (YYYYMM); bump as LinkedIn deprecates.

function headers(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    'linkedin-version': VERSION,
    'x-restli-protocol-version': '2.0.0',
    'content-type': 'application/json',
    ...extra,
  };
}

function tok(config: ChannelConfig): string | undefined {
  return cfg(config, 'access_token', 'LINKEDIN_ACCESS_TOKEN');
}
function currency(config: ChannelConfig): string {
  return cfg(config, 'currency', 'LINKEDIN_CURRENCY') ?? 'ILS';
}

async function partialUpdate(token: string, id: string, set: Record<string, unknown>): Promise<boolean> {
  const { ok } = await jsonFetch(`${BASE}/adCampaigns/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: headers(token, { 'x-restli-method': 'PARTIAL_UPDATE' }),
    body: JSON.stringify({ patch: { $set: set } }),
  });
  return ok;
}

export const linkedinConnector: AdConnector = {
  platform: 'LinkedIn',

  async pauseAd(config, ref) {
    const t = tok(config);
    if (!t || !ref.campaignId) return false;
    return partialUpdate(t, ref.campaignId, { status: 'PAUSED' });
  },

  async setBudget(config, ref, daily) {
    const t = tok(config);
    if (!t || !ref.campaignId) return false;
    return partialUpdate(t, ref.campaignId, {
      dailyBudget: { amount: daily.toFixed(2), currencyCode: currency(config) },
    });
  },

  async uploadCreative(config, _c) {
    // A LinkedIn creative wraps an existing sponsored post (ugcPost/share). Creating
    // that post + the creative is a multi-call flow we don't do blind; surface it
    // clearly rather than fail silently. Pause/budget/insights are fully supported.
    const t = tok(config);
    if (!t) return { ok: false, error: 'linkedin_not_configured' };
    return { ok: false, error: 'linkedin_creative_requires_sponsored_post', ref: {} };
  },

  async fetchInsights(config, ref) {
    const t = tok(config);
    if (!t || !ref.campaignId) return null;
    const camp = `urn:li:sponsoredCampaign:${ref.campaignId}`;
    // Restli finder: q=analytics, ALL-time via a wide dateRange, pivot on the campaign.
    const params =
      `q=analytics&pivot=CAMPAIGN&timeGranularity=ALL` +
      `&dateRange=(start:(year:2020,month:1,day:1),end:(year:2035,month:12,day:31))` +
      `&campaigns=List(${encodeURIComponent(camp)})` +
      `&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,conversionValueInLocalCurrency`;
    const { ok, json } = await jsonFetch(`${BASE}/adAnalytics?${params}`, { method: 'GET', headers: headers(t) });
    if (!ok) return null;
    const el = (json.elements as Record<string, number>[] | undefined)?.[0];
    if (!el) return null;
    const row: InsightRow = {
      impressions: Number(el.impressions ?? 0) || 0,
      clicks: Number(el.clicks ?? 0) || 0,
      spend: Number(el.costInLocalCurrency ?? 0) || 0,
      conversions: Number(el.externalWebsiteConversions ?? 0) || 0,
      revenue: Number(el.conversionValueInLocalCurrency ?? 0) || 0,
    };
    return row;
  },

  async createCampaign(config, spec) {
    const t = tok(config);
    const acctId = cfg(config, 'account_id', 'LINKEDIN_ACCOUNT_ID');
    if (!t || !acctId) return { ok: false, error: 'linkedin_not_configured' };
    const OBJ: Record<string, string> = {
      traffic: 'WEBSITE_VISIT',
      leads: 'LEAD_GENERATION',
      awareness: 'BRAND_AWARENESS',
      conversions: 'WEBSITE_CONVERSION',
      sales: 'WEBSITE_CONVERSION',
      engagement: 'ENGAGEMENT',
    };
    // Created PAUSED. Minimal valid Sponsored-Content campaign; targeting is a broad IL
    // locale seed (LinkedIn requires targetingCriteria) — refine in the UI after review.
    const geo = spec.audiences[0]?.countries?.[0] ?? 'IL';
    const body = {
      account: `urn:li:sponsoredAccount:${acctId}`,
      name: spec.name,
      type: 'SPONSORED_UPDATES',
      costType: 'CPM',
      status: 'PAUSED',
      objectiveType: OBJ[spec.objective ?? 'traffic'] ?? 'WEBSITE_VISIT',
      dailyBudget: { amount: spec.dailyBudget.toFixed(2), currencyCode: currency(config) },
      locale: { country: geo, language: 'en' },
      runSchedule: { start: Date.now() },
      targetingCriteria: {
        include: { and: [{ or: { 'urn:li:adTargetingFacet:locations': [`urn:li:geo:${geo === 'IL' ? '101620260' : '0'}`] } }] },
      },
    };
    const { ok, json, status } = await jsonFetch(`${BASE}/adCampaigns`, {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(body),
    });
    if (!ok) return { ok: false, error: (json.message as string) || `linkedin_campaign_failed_${status}` };
    // LinkedIn returns the new id in the x-restli-id header; body may be empty. Best-effort parse.
    const campaignId = (json.id as string) || undefined;
    return { ok: true, campaignId, note: 'linkedin: campaign created (paused). Attach a sponsored post + creative to run.' };
  },
};
