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
export type MetaCampaignOpts = {
  name: string;
  objective?: string;        // OUTCOME_TRAFFIC | OUTCOME_LEADS | OUTCOME_AWARENESS | ...
  dailyBudget: number;       // major units (₪); converted to minor for the API
  optimizationGoal?: string; // LINK_CLICKS | REACH | LANDING_PAGE_VIEWS | ...
  targeting?: MetaTargeting;
  link?: string;
  creatives: { message: string; picture?: string }[];
};
export type MetaCampaignResult = { ok: boolean; campaignId?: string; adsetId?: string; adIds?: string[]; error?: string };

export async function createMetaCampaign(config: ChannelConfig, opts: MetaCampaignOpts): Promise<MetaCampaignResult> {
  const adAccount = (config.ad_account_id as string | undefined) || process.env.FB_AD_ACCOUNT_ID;
  const token = (config.access_token as string | undefined) || process.env.FB_ADS_TOKEN;
  const pageId = (config.page_id as string | undefined) || process.env.FB_PAGE_ID;
  if (!adAccount || !token || !pageId) return { ok: false, error: 'meta_ads_not_configured' };
  const acct = adAccount.startsWith('act_') ? adAccount : `act_${adAccount}`;
  const base = `https://graph.facebook.com/v20.0`;

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) throw new Error(json.error?.message || `meta_${res.status}`);
    return json.id;
  };

  try {
    // 1) Campaign (PAUSED).
    const campaignId = await post(`${acct}/campaigns`, {
      name: opts.name, objective: opts.objective || 'OUTCOME_TRAFFIC', status: 'PAUSED', special_ad_categories: [],
    });

    // 2) Ad Set — budget (minor units), targeting, optimization (PAUSED).
    const t = opts.targeting ?? {};
    const adsetId = await post(`${acct}/adsets`, {
      name: `${opts.name} — AdSet`, campaign_id: campaignId,
      daily_budget: Math.round(opts.dailyBudget * 100),
      billing_event: 'IMPRESSIONS', optimization_goal: opts.optimizationGoal || 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP', status: 'PAUSED',
      targeting: { geo_locations: { countries: t.countries ?? ['IL'] }, age_min: t.ageMin ?? 18, age_max: t.ageMax ?? 65 },
    });

    // 3) One creative + ad per variant → Meta A/B-tests them within the ad set.
    const adIds: string[] = [];
    for (const c of opts.creatives) {
      const creativeId = await post(`${acct}/adcreatives`, {
        name: c.message.slice(0, 40),
        object_story_spec: { page_id: pageId, link_data: { message: c.message, link: opts.link || 'https://example.com', ...(c.picture ? { picture: c.picture } : {}) } },
      });
      const adId = await post(`${acct}/ads`, { name: c.message.slice(0, 40), adset_id: adsetId, creative: { creative_id: creativeId }, status: 'PAUSED' });
      adIds.push(adId);
    }

    return { ok: true, campaignId, adsetId, adIds };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
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
