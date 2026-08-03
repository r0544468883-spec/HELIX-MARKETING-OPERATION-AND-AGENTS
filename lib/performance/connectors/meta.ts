import type { AdConnector } from './types';
import { pauseMetaAd, setMetaAdsetBudget, fetchMetaAdInsights, publishPaid } from '../../distribution/paid';

// Meta (Facebook/Instagram) — wraps the existing Marketing-API helpers in paid.ts.
// Fully implemented (this is the platform OPS already supports end-to-end).
export const metaConnector: AdConnector = {
  platform: 'Meta',

  pauseAd: (config, ref) => (ref.adId ? pauseMetaAd(config, ref.adId) : Promise.resolve(false)),

  setBudget: (config, ref, daily) => (ref.adsetId ? setMetaAdsetBudget(config, ref.adsetId, daily) : Promise.resolve(false)),

  async uploadCreative(config, c) {
    const message = [c.headline, c.body].filter(Boolean).join('\n\n') || c.name;
    // publishMeta reads the link from config; inject the creative's link if provided.
    const merged = { ...config, link: c.link ?? config.link };
    const r = await publishPaid('פייסבוק', merged, message, { mediaUrl: c.mediaUrl });
    return { ok: r.ok, externalId: r.externalId, ref: r.externalId ? { adId: r.externalId } : undefined, error: r.error };
  },

  async fetchInsights(config, ref) {
    if (!ref.adId) return null;
    const s = await fetchMetaAdInsights(config, ref.adId);
    return s ? { impressions: s.impressions, clicks: s.clicks } : null;
  },
};
