import type { ChannelConfig } from '../distribution/types';

// Per-variant real metrics from the platforms. Given the platform post/creative id
// (stored as content_variants.external_id at publish time), fetch impressions,
// video views, and clicks. Degrades to null when not configured — the caller keeps
// the previous numbers. Meta (facebook/instagram) implemented; others best-effort.
export type VariantMetrics = { impressions?: number; views?: number; clicks?: number; conversions?: number };

export async function fetchInsights(channel: string, config: ChannelConfig, externalId: string): Promise<VariantMetrics | null> {
  if (!externalId) return null;
  if (channel === 'פייסבוק' || channel === 'אינסטגרם') return metaInsights(config, externalId);
  if (channel === 'TikTok') return tiktokInsights(config, externalId);
  if (channel === 'YouTube') return youtubeInsights(config, externalId);
  return null;
}

// Meta Graph API post insights. Works for organic posts and (with ad token) creatives.
async function metaInsights(config: ChannelConfig, postId: string): Promise<VariantMetrics | null> {
  const token = (config.access_token as string | undefined) || process.env.FB_ADS_TOKEN;
  if (!token) return null;
  try {
    const metrics = 'post_impressions,post_impressions_unique,post_video_views,post_clicks';
    const res = await fetch(`https://graph.facebook.com/v20.0/${postId}/insights?metric=${metrics}&access_token=${token}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { name: string; values?: { value?: number }[] }[] };
    const get = (name: string) => json.data?.find((d) => d.name === name)?.values?.[0]?.value ?? 0;
    return {
      impressions: get('post_impressions'),
      views: get('post_video_views'),
      clicks: get('post_clicks'),
    };
  } catch {
    return null;
  }
}

// TikTok video query — needs the Content Posting/Query API token + scope.
async function tiktokInsights(config: ChannelConfig, videoId: string): Promise<VariantMetrics | null> {
  const token = config.access_token as string | undefined;
  if (!token) return null;
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=view_count,like_count,share_count', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ filters: { video_ids: [videoId] } }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { videos?: { view_count?: number }[] } };
    const v = json.data?.videos?.[0];
    return { views: v?.view_count ?? 0 };
  } catch {
    return null;
  }
}

// YouTube Data API stats for a video id.
async function youtubeInsights(config: ChannelConfig, videoId: string): Promise<VariantMetrics | null> {
  const token = config.access_token as string | undefined;
  if (!token) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: { statistics?: { viewCount?: string } }[] };
    const s = json.items?.[0]?.statistics;
    return { views: parseInt(s?.viewCount ?? '0', 10) || 0 };
  } catch {
    return null;
  }
}
