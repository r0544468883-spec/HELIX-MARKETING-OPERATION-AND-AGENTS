// Autonomous budget loop (#4) — for each paid ad set, once it has enough data,
// keep the best-performing ad ACTIVE and PAUSE the rest. Because the ads share the
// ad set's budget, pausing losers concentrates spend on the winner ("boost what
// works, stop what doesn't"). It never raises spend beyond the set budget, so it
// can't overspend. Safe to run repeatedly.
import type { ChannelConfig } from './distribution/types';
import { fetchMetaAdInsights, pauseMetaAd } from './distribution/paid';

const MIN_IMPRESSIONS = 1000; // don't judge before an ad set has real signal

type PaidCampaign = { adsets?: { name: string; adsetId: string; adIds: string[] }[] };

export async function optimizePaidAsset(config: ChannelConfig, paid: PaidCampaign): Promise<{ paused: number; kept: number }> {
  let paused = 0, kept = 0;
  for (const adset of paid.adsets ?? []) {
    // Gather each ad's stats.
    const stats: { adId: string; impressions: number; clicks: number }[] = [];
    for (const adId of adset.adIds) {
      const s = await fetchMetaAdInsights(config, adId);
      if (s) stats.push({ adId, ...s });
    }
    const total = stats.reduce((n, s) => n + s.impressions, 0);
    if (stats.length < 2 || total < MIN_IMPRESSIONS) continue; // not enough signal yet

    // Winner by CTR (clicks per impression); pause the rest.
    const ctr = (s: { clicks: number; impressions: number }) => (s.impressions ? s.clicks / s.impressions : 0);
    const winner = stats.reduce((best, s) => (ctr(s) > ctr(best) ? s : best), stats[0]);
    for (const s of stats) {
      if (s.adId === winner.adId) { kept++; continue; }
      if (await pauseMetaAd(config, s.adId)) paused++;
    }
  }
  return { paused, kept };
}
