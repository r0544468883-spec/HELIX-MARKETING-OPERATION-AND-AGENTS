import type { AdConnector, ChannelConfig, InsightRow } from './types';
import { cfg, jsonFetch } from './types';

// Outbrain Amplify — API v0.1 (native ads). Auth is an OB-TOKEN-V1 header; you either
// pass a long-lived token, or username+password which we exchange at /login.
// config: { token } OR { username, password }, plus { marketer_id } for reports.
// Pause = campaign enabled:false; budget = PUT /budgets/{id}; stats = marketer report.
const BASE = 'https://api.outbrain.com/amplify/v0.1';

async function token(config: ChannelConfig): Promise<string | null> {
  const direct = cfg(config, 'token', 'OUTBRAIN_TOKEN');
  if (direct) return direct;
  const user = cfg(config, 'username', 'OUTBRAIN_USER');
  const pass = cfg(config, 'password', 'OUTBRAIN_PASSWORD');
  if (!user || !pass) return null;
  const basic = Buffer.from(`${user}:${pass}`).toString('base64');
  const { ok, json } = await jsonFetch(`${BASE}/login`, { method: 'GET', headers: { authorization: `Basic ${basic}` } });
  return ok ? ((json['OB-TOKEN-V1'] as string) ?? null) : null;
}

export const outbrainConnector: AdConnector = {
  platform: 'Outbrain',

  async pauseAd(config, ref) {
    const t = await token(config);
    const id = ref.campaignId; // pause the campaign the creative belongs to
    if (!t || !id) return false;
    const { ok } = await jsonFetch(`${BASE}/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'OB-TOKEN-V1': t, 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    return ok;
  },

  async setBudget(config, ref, daily) {
    const t = await token(config);
    if (!t || !ref.budgetId) return false;
    // Outbrain budgets are typically monthly/total; we set the amount to daily×30 as a
    // monthly proxy when the budget is not daily. (A daily-capped budget would use the
    // same field.) Adjust if the account uses daily budgets.
    const { ok } = await jsonFetch(`${BASE}/budgets/${ref.budgetId}`, {
      method: 'PUT',
      headers: { 'OB-TOKEN-V1': t, 'content-type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(daily * 30) }),
    });
    return ok;
  },

  async uploadCreative(config, cr) {
    const t = await token(config);
    if (!t || !cr.link) return { ok: false, error: 'outbrain_not_configured_or_no_link' };
    const campaignId = cfg(config, 'campaign_id', 'OUTBRAIN_CAMPAIGN_ID');
    if (!campaignId) return { ok: false, error: 'outbrain_no_campaign_id' };
    // A promoted link = the native creative (headline + url + image).
    const { ok, json } = await jsonFetch(`${BASE}/campaigns/${campaignId}/promotedLinks`, {
      method: 'POST',
      headers: { 'OB-TOKEN-V1': t, 'content-type': 'application/json' },
      body: JSON.stringify({
        promotedLinks: [{ text: cr.headline || cr.name, url: cr.link, imageUrl: cr.mediaUrl }],
      }),
    });
    if (!ok) return { ok: false, error: (json.message as string) || 'outbrain_upload_failed' };
    const created = (json.promotedLinks as { id?: string }[] | undefined)?.[0];
    return { ok: true, externalId: created?.id, ref: { promotedLinkId: created?.id, campaignId } };
  },

  async fetchInsights(config, ref) {
    const t = await token(config);
    const marketerId = cfg(config, 'marketer_id', 'OUTBRAIN_MARKETER_ID');
    if (!t || !marketerId || !ref.campaignId) return null;
    const params = new URLSearchParams({ campaignId: ref.campaignId, from: '2020-01-01' });
    const { ok, json } = await jsonFetch(`${BASE}/reports/marketers/${marketerId}/campaigns?${params}`, {
      method: 'GET',
      headers: { 'OB-TOKEN-V1': t },
    });
    if (!ok) return null;
    const results = (json.results as { metrics?: Record<string, number> }[] | undefined) ?? [];
    const m = results[0]?.metrics;
    if (!m) return null;
    const row: InsightRow = {
      impressions: Number(m.impressions ?? 0) || 0,
      clicks: Number(m.clicks ?? 0) || 0,
      spend: Number(m.spend ?? 0) || 0,
      conversions: Number(m.conversions ?? 0) || 0,
      revenue: Number(m.sumValue ?? m.conversionsValue ?? 0) || 0,
    };
    return row;
  },

  async createCampaign(config, spec) {
    const t = await token(config);
    const marketerId = cfg(config, 'marketer_id', 'OUTBRAIN_MARKETER_ID');
    if (!t || !marketerId) return { ok: false, error: 'outbrain_not_configured' };
    // Native campaigns carry their own budget + CPC. We create it disabled with a
    // monthly budget (daily×30 proxy) and default IL geo; promoted links (creatives)
    // are added via uploadCreative once the pool goes live.
    const geo = spec.audiences[0]?.countries ?? ['IL'];
    const { ok, json } = await jsonFetch(`${BASE}/marketers/${marketerId}/campaigns`, {
      method: 'POST',
      headers: { 'OB-TOKEN-V1': t, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: spec.name,
        enabled: false,
        cpc: 0.5,
        budget: { amount: Math.round(spec.dailyBudget * 30), type: 'MONTHLY', pacing: 'SPREAD' },
        targeting: { platform: ['DESKTOP', 'MOBILE', 'TABLET'], geo: geo.map((code) => ({ code, type: 'Country' })) },
      }),
    });
    if (!ok) return { ok: false, error: (json.message as string) || 'outbrain_campaign_failed' };
    const campaignId = (json.id as string) || undefined;
    const budgetId = ((json.budget as { id?: string } | undefined)?.id) || undefined;
    return { ok: true, campaignId, note: `outbrain: campaign created (disabled${budgetId ? `, budgetId ${budgetId}` : ''}). Promoted links pending.` };
  },
};
