import type { AdConnector, CampaignObjective } from './types';
import { pauseMetaAd, setMetaAdsetBudget, fetchMetaAdInsights, publishPaid, createMetaCampaign } from '../../distribution/paid';

// Normalized objective → Meta OUTCOME_* + a sensible optimization goal.
const META_OBJECTIVE: Record<CampaignObjective, { objective: string; optimizationGoal: string }> = {
  traffic: { objective: 'OUTCOME_TRAFFIC', optimizationGoal: 'LINK_CLICKS' },
  leads: { objective: 'OUTCOME_LEADS', optimizationGoal: 'LEAD_GENERATION' },
  awareness: { objective: 'OUTCOME_AWARENESS', optimizationGoal: 'REACH' },
  conversions: { objective: 'OUTCOME_SALES', optimizationGoal: 'OFFSITE_CONVERSIONS' },
  sales: { objective: 'OUTCOME_SALES', optimizationGoal: 'OFFSITE_CONVERSIONS' },
  engagement: { objective: 'OUTCOME_ENGAGEMENT', optimizationGoal: 'POST_ENGAGEMENT' },
};

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

  async createCampaign(config, spec) {
    const map = META_OBJECTIVE[spec.objective ?? 'traffic'];
    const r = await createMetaCampaign(config, {
      name: spec.name,
      objective: map.objective,
      optimizationGoal: map.optimizationGoal,
      dailyBudget: spec.dailyBudget,
      link: spec.link,
      audiences: spec.audiences.map((a) => ({
        name: a.name,
        targeting: { countries: a.countries, ageMin: a.ageMin, ageMax: a.ageMax },
      })),
      creatives: spec.creatives.map((c) => ({
        message: [c.headline, c.body].filter(Boolean).join('\n\n') || c.name || spec.name,
        picture: c.mediaUrl,
      })),
    });
    if (!r.ok) return { ok: false, error: r.error };
    return {
      ok: true,
      campaignId: r.campaignId,
      adsetIds: r.adsets?.map((s) => s.adsetId),
      adIds: r.adsets?.flatMap((s) => s.adIds),
    };
  },
};
