import type { AdConnector, ChannelConfig, InsightRow } from './types';
import { cfg, jsonFetch } from './types';

// Taboola Backstage — API v1.0 (native ads; Outbrain's twin). OAuth2 client_credentials
// → Bearer token. All resources are account-scoped: /backstage/api/1.0/{account_id}/...
// config: { client_id, client_secret, account_id }  (+ optional { campaign_id } for uploads).
// Pause = campaign is_active:false; budget = daily_cap; stats = campaign report; creative = item.
const OAUTH = 'https://backstage.taboola.com/backstage/oauth/token';
const BASE = 'https://backstage.taboola.com/backstage/api/1.0';

async function token(config: ChannelConfig): Promise<string | null> {
  const direct = cfg(config, 'token', 'TABOOLA_TOKEN');
  if (direct) return direct;
  const id = cfg(config, 'client_id', 'TABOOLA_CLIENT_ID');
  const secret = cfg(config, 'client_secret', 'TABOOLA_CLIENT_SECRET');
  if (!id || !secret) return null;
  const body = new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' });
  const { ok, json } = await jsonFetch(OAUTH, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return ok ? ((json['access_token'] as string) ?? null) : null;
}

function account(config: ChannelConfig): string | undefined {
  return cfg(config, 'account_id', 'TABOOLA_ACCOUNT_ID');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const taboolaConnector: AdConnector = {
  platform: 'Taboola',

  async pauseAd(config, ref) {
    const t = await token(config);
    const acct = account(config);
    const id = ref.campaignId;
    if (!t || !acct || !id) return false;
    const { ok } = await jsonFetch(`${BASE}/${acct}/campaigns/${id}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    });
    return ok;
  },

  async setBudget(config, ref, daily) {
    const t = await token(config);
    const acct = account(config);
    if (!t || !acct || !ref.campaignId) return false;
    const { ok } = await jsonFetch(`${BASE}/${acct}/campaigns/${ref.campaignId}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify({ daily_cap: daily }),
    });
    return ok;
  },

  async uploadCreative(config, cr) {
    const t = await token(config);
    const acct = account(config);
    const campaignId = cr && (cfg(config, 'campaign_id', 'TABOOLA_CAMPAIGN_ID'));
    if (!t || !acct || !cr.link) return { ok: false, error: 'taboola_not_configured_or_no_link' };
    if (!campaignId) return { ok: false, error: 'taboola_no_campaign_id' };
    // A campaign "item" = the native creative (title + url + thumbnail).
    const { ok, json } = await jsonFetch(`${BASE}/${acct}/campaigns/${campaignId}/items/`, {
      method: 'POST',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url: cr.link, title: cr.headline || cr.name, thumbnail_url: cr.mediaUrl }),
    });
    if (!ok) return { ok: false, error: (json.message as string) || 'taboola_upload_failed' };
    const itemId = (json.id as string) || undefined;
    return { ok: true, externalId: itemId, ref: { promotedLinkId: itemId, campaignId } };
  },

  async fetchInsights(config, ref) {
    const t = await token(config);
    const acct = account(config);
    if (!t || !acct || !ref.campaignId) return null;
    const params = new URLSearchParams({ start_date: '2020-01-01', end_date: today(), campaign: ref.campaignId });
    const { ok, json } = await jsonFetch(
      `${BASE}/${acct}/reports/campaign-summary/dimensions/campaign_breakdown?${params}`,
      { method: 'GET', headers: { authorization: `Bearer ${t}` } },
    );
    if (!ok) return null;
    const results = (json.results as Record<string, number>[] | undefined) ?? [];
    const r = results[0];
    if (!r) return null;
    const row: InsightRow = {
      impressions: Number(r.impressions ?? 0) || 0,
      clicks: Number(r.clicks ?? 0) || 0,
      spend: Number(r.spent ?? 0) || 0,
      conversions: Number(r.cpa_actions_num ?? r.actions ?? 0) || 0,
      revenue: Number(r.cpa_conversions_value ?? r.conversions_value ?? 0) || 0,
    };
    return row;
  },

  async createCampaign(config, spec) {
    const t = await token(config);
    const acct = account(config);
    if (!t || !acct) return { ok: false, error: 'taboola_not_configured' };
    const geo = spec.audiences[0]?.countries ?? ['IL'];
    // Created PAUSED (is_active:false). Taboola carries budget on the campaign; we map the
    // daily budget → daily_cap and a monthly spending_limit (daily×30) proxy. Items
    // (creatives) are added via uploadCreative once the pool is live.
    const { ok, json } = await jsonFetch(`${BASE}/${acct}/campaigns/`, {
      method: 'POST',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: spec.name,
        branding_text: spec.creatives[0]?.headline || spec.name,
        marketing_objective: spec.objective === 'awareness' ? 'BRAND_AWARENESS' : 'DRIVE_WEBSITE_TRAFFIC',
        cpc: 0.5,
        spending_limit: { amount: Math.round(spec.dailyBudget * 30), type: 'MONTHLY' },
        daily_cap: spec.dailyBudget,
        is_active: false,
        country_targeting: { type: 'INCLUDE', value: geo },
      }),
    });
    if (!ok) return { ok: false, error: (json.message as string) || 'taboola_campaign_failed' };
    const campaignId = (json.id as string) || undefined;
    return { ok: true, campaignId, note: 'taboola: campaign created (paused). Items (creatives) pending.' };
  },
};
