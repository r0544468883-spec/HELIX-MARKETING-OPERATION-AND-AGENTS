import type { AdConnector, ChannelConfig, InsightRow } from './types';
import { cfg, jsonFetch } from './types';

// TikTok Ads — Business/Marketing API v1.3. Auth is a header token + advertiser_id.
// config: { access_token, advertiser_id }. All responses wrap { code, message, data };
// code === 0 means success. Endpoint shapes follow TikTok's v1.3 docs; field names may
// need a tweak against a live account, so every call degrades cleanly on non-zero code.
const BASE = 'https://business-api.tiktok.com/open_api/v1.3';

function ctx(config: ChannelConfig) {
  const token = cfg(config, 'access_token', 'TIKTOK_ACCESS_TOKEN');
  const advertiserId = cfg(config, 'advertiser_id', 'TIKTOK_ADVERTISER_ID');
  if (!token || !advertiserId) return null;
  const headers = { 'Access-Token': token, 'Content-Type': 'application/json' };
  return { advertiserId, headers };
}

const ok = (j: Record<string, unknown>) => j.code === 0;

export const tiktokConnector: AdConnector = {
  platform: 'TikTok',

  async pauseAd(config, ref) {
    const c = ctx(config);
    if (!c || !ref.adId) return false;
    const { json } = await jsonFetch(`${BASE}/ad/status/update/`, {
      method: 'POST',
      headers: c.headers,
      body: JSON.stringify({ advertiser_id: c.advertiserId, ad_ids: [ref.adId], operation_status: 'DISABLE' }),
    });
    return ok(json);
  },

  async setBudget(config, ref, daily) {
    const c = ctx(config);
    const groupId = ref.adGroupId;
    if (!c || !groupId) return false;
    const { json } = await jsonFetch(`${BASE}/adgroup/budget/update/`, {
      method: 'POST',
      headers: c.headers,
      body: JSON.stringify({ advertiser_id: c.advertiserId, budget_updates: [{ adgroup_id: groupId, budget: daily }] }),
    });
    return ok(json);
  },

  async uploadCreative(config, cr) {
    // Full TikTok creative needs a video upload (file/URL) → creative → ad, a multi-step
    // flow that requires the ad group id and a hosted video. Not auto-built here: the
    // client seeds ready creatives and owns platform connectivity (per the spec). We
    // register intent and return not_implemented so the pipeline stays honest.
    void cr;
    return { ok: false, error: 'tiktok_upload_not_implemented' };
  },

  async fetchInsights(config, ref) {
    const c = ctx(config);
    if (!c || !ref.adId) return null;
    const params = new URLSearchParams({
      advertiser_id: c.advertiserId,
      report_type: 'BASIC',
      data_level: 'AUCTION_AD',
      dimensions: JSON.stringify(['ad_id']),
      metrics: JSON.stringify(['impressions', 'clicks', 'spend', 'conversion', 'complete_payment_roas']),
      filters: JSON.stringify([{ field_name: 'ad_ids', filter_type: 'IN', filter_value: JSON.stringify([ref.adId]) }]),
    });
    const { json } = await jsonFetch(`${BASE}/report/integrated/get/?${params}`, { method: 'GET', headers: c.headers });
    if (!ok(json)) return null;
    const data = json.data as { list?: { metrics?: Record<string, string> }[] } | undefined;
    const m = data?.list?.[0]?.metrics;
    if (!m) return null;
    const num = (k: string) => Number(m[k] ?? 0) || 0;
    const conv = num('conversion');
    const spend = num('spend');
    const row: InsightRow = {
      impressions: num('impressions'),
      clicks: num('clicks'),
      spend,
      conversions: conv,
      revenue: (num('complete_payment_roas') || 0) * spend, // ROAS×spend ≈ revenue
    };
    return row;
  },
};
