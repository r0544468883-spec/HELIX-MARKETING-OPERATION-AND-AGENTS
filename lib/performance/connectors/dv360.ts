import type { AdConnector, ChannelConfig, InsightRow } from './types';
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
// Auth: OAuth2 Bearer (Google). config: { access_token, advertiser_id, partner_id? }.
// Env fallback: DV360_ACCESS_TOKEN, DV360_ADVERTISER_ID, DV360_PARTNER_ID.
// We act at the LINE ITEM level (ref.adId = lineItemId): pause = entityStatus,
// budget = budget.maxAmount (micros). Reporting runs through the async Bid Manager API,
// so fetchInsights returns null here (wired in a later phase) — the engine treats a null
// the same as any other "no live stats yet".
const BASE = 'https://displayvideo.googleapis.com/v3';

function token(config: ChannelConfig): string | undefined {
  return cfg(config, 'access_token', 'DV360_ACCESS_TOKEN');
}
function advertiser(config: ChannelConfig): string | undefined {
  return cfg(config, 'advertiser_id', 'DV360_ADVERTISER_ID');
}

export const dv360Connector: AdConnector = {
  platform: 'DV360',

  async pauseAd(config, ref) {
    const t = token(config);
    const adv = advertiser(config);
    const lineItemId = ref.adId ?? ref.campaignId;
    if (!t || !adv || !lineItemId) return false;
    const { ok } = await jsonFetch(
      `${BASE}/advertisers/${adv}/lineItems/${lineItemId}?updateMask=entityStatus`,
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
      `${BASE}/advertisers/${adv}/lineItems/${lineItemId}?updateMask=budget.maxAmount`,
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

  async fetchInsights(_config, _ref) {
    // Live stats come from the async Bid Manager (DBM) reporting API (create query → poll →
    // download CSV). Not inlined here; returns null so the engine degrades cleanly.
    return null;
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
