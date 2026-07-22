import type { ChannelConfig, SendResult } from './types';

// Paid (ממומן) publishing. Facebook/Instagram go through the Meta Marketing API
// (ad account → ad creative). Google Ads is a stub pending the Ads API. Returns a
// clear not_configured when credentials are missing, so the flow degrades cleanly.
// config expects: { ad_account_id, access_token, page_id? }; opts: { budget, mediaUrl }.
export async function publishPaid(
  channel: string,
  config: ChannelConfig,
  content: string,
  opts: { budget?: number; mediaUrl?: string } = {}
): Promise<SendResult> {
  if (channel === 'פייסבוק' || channel === 'אינסטגרם') return publishMeta(config, content, opts);
  if (channel === 'לינקדאין') return { ok: false, error: 'linkedin_paid_not_configured' };
  return { ok: false, error: 'paid_not_supported_for_channel' };
}

// ── Full Meta paid campaign automation ────────────────────────────────────
// Builds the whole hierarchy: Campaign → Ad Set (budget + targeting + optimization)
// → one Ad per variant creative (A/B). Everything is created **PAUSED** — HELIX
// never spends money on its own; the user activates in Ads Manager after review.
export type MetaTargeting = { countries?: string[]; ageMin?: number; ageMax?: number };
export type MetaAudience = { name: string; targeting: MetaTargeting };
export type MetaCampaignOpts = {
  name: string;
  objective?: string;        // OUTCOME_TRAFFIC | OUTCOME_LEADS | OUTCOME_AWARENESS | ...
  dailyBudget: number;       // major units (₪); converted to minor for the API
  optimizationGoal?: string; // LINK_CLICKS | REACH | LANDING_PAGE_VIEWS | ...
  targeting?: MetaTargeting; // single-audience fallback
  audiences?: MetaAudience[]; // multi-audience → one ad set per audience (#2)
  link?: string;
  creatives: { message: string; picture?: string }[];
};
export type MetaAdset = { name: string; adsetId: string; adIds: string[] };
export type MetaCampaignResult = { ok: boolean; campaignId?: string; adsets?: MetaAdset[]; error?: string };

function metaClient(config: ChannelConfig) {
  const adAccount = (config.ad_account_id as string | undefined) || process.env.FB_AD_ACCOUNT_ID;
  const token = (config.access_token as string | undefined) || process.env.FB_ADS_TOKEN;
  const pageId = (config.page_id as string | undefined) || process.env.FB_PAGE_ID;
  if (!adAccount || !token) return null;
  const acct = adAccount.startsWith('act_') ? adAccount : `act_${adAccount}`;
  const base = 'https://graph.facebook.com/v20.0';
  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { id?: string; success?: boolean; error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || `meta_${res.status}`);
    return json;
  };
  return { acct, pageId, post };
}

export async function createMetaCampaign(config: ChannelConfig, opts: MetaCampaignOpts): Promise<MetaCampaignResult> {
  const m = metaClient(config);
  if (!m || !m.pageId) return { ok: false, error: 'meta_ads_not_configured' };
  const { acct, pageId, post } = m;
  const postId = async (path: string, body: Record<string, unknown>) => { const j = await post(path, body); if (!j.id) throw new Error('meta_no_id'); return j.id; };

  // Audiences: explicit list, else a single audience from targeting.
  const audiences: MetaAudience[] = opts.audiences?.length ? opts.audiences : [{ name: opts.name, targeting: opts.targeting ?? {} }];
  const perAdsetBudget = Math.max(500, Math.round((opts.dailyBudget * 100) / audiences.length)); // minor units, ₪5 floor

  try {
    const campaignId = await postId(`${acct}/campaigns`, { name: opts.name, objective: opts.objective || 'OUTCOME_TRAFFIC', status: 'PAUSED', special_ad_categories: [] });

    // Reuse one creative per variant across all audiences.
    const creativeIds: string[] = [];
    for (const c of opts.creatives) {
      creativeIds.push(await postId(`${acct}/adcreatives`, { name: c.message.slice(0, 40), object_story_spec: { page_id: pageId, link_data: { message: c.message, link: opts.link || 'https://example.com', ...(c.picture ? { picture: c.picture } : {}) } } }));
    }

    // One Ad Set per audience (its own targeting) → the same A/B creatives inside each.
    const adsets: MetaAdset[] = [];
    for (const aud of audiences) {
      const t = aud.targeting ?? {};
      const adsetId = await postId(`${acct}/adsets`, {
        name: `${opts.name} — ${aud.name}`, campaign_id: campaignId, daily_budget: perAdsetBudget,
        billing_event: 'IMPRESSIONS', optimization_goal: opts.optimizationGoal || 'LINK_CLICKS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP', status: 'PAUSED',
        targeting: { geo_locations: { countries: t.countries ?? ['IL'] }, age_min: t.ageMin ?? 18, age_max: t.ageMax ?? 65 },
      });
      const adIds: string[] = [];
      for (let i = 0; i < creativeIds.length; i++) {
        adIds.push(await postId(`${acct}/ads`, { name: `${aud.name} #${i + 1}`, adset_id: adsetId, creative: { creative_id: creativeIds[i] }, status: 'PAUSED' }));
      }
      adsets.push({ name: aud.name, adsetId, adIds });
    }

    return { ok: true, campaignId, adsets };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Budget-loop primitives (#4): pause an underperforming ad; adjust an ad set budget.
export async function pauseMetaAd(config: ChannelConfig, adId: string): Promise<boolean> {
  const m = metaClient(config); if (!m) return false;
  try { await m.post(adId, { status: 'PAUSED' }); return true; } catch { return false; }
}
export async function setMetaAdsetBudget(config: ChannelConfig, adsetId: string, dailyBudgetMajor: number): Promise<boolean> {
  const m = metaClient(config); if (!m) return false;
  try { await m.post(adsetId, { daily_budget: Math.round(dailyBudgetMajor * 100) }); return true; } catch { return false; }
}

// Ad-level insights for the budget loop — impressions + clicks per ad.
export async function fetchMetaAdInsights(config: ChannelConfig, adId: string): Promise<{ impressions: number; clicks: number } | null> {
  const token = (config.access_token as string | undefined) || process.env.FB_ADS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${adId}/insights?fields=impressions,clicks&access_token=${token}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { impressions?: string; clicks?: string }[] };
    const row = json.data?.[0];
    return { impressions: parseInt(row?.impressions ?? '0', 10) || 0, clicks: parseInt(row?.clicks ?? '0', 10) || 0 };
  } catch {
    return null;
  }
}

// Create a Meta ad creative (the reusable unit an ad references). Full campaign/
// adset creation with budget is left to the ads manager or a later step; here we
// register the creative so multiple variants can be A/B-tested as separate ads.
async function publishMeta(config: ChannelConfig, content: string, opts: { budget?: number; mediaUrl?: string }): Promise<SendResult> {
  const adAccount = (config.ad_account_id as string | undefined) || process.env.FB_AD_ACCOUNT_ID;
  const token = (config.access_token as string | undefined) || process.env.FB_ADS_TOKEN;
  const pageId = (config.page_id as string | undefined) || process.env.FB_PAGE_ID;
  if (!adAccount || !token || !pageId) return { ok: false, error: 'meta_ads_not_configured' };

  const acct = adAccount.startsWith('act_') ? adAccount : `act_${adAccount}`;
  const object_story_spec: Record<string, unknown> = {
    page_id: pageId,
    link_data: { message: content, link: (config.link as string) || 'https://example.com', ...(opts.mediaUrl ? { picture: opts.mediaUrl } : {}) },
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${acct}/adcreatives`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: content.slice(0, 40), object_story_spec }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) return { ok: false, error: json.error?.message || `meta_ads_${res.status}` };
    return { ok: true, externalId: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
