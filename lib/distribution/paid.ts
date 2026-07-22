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
