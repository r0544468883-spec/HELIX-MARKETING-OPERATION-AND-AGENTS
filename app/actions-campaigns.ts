'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateChannelVariants } from '@/lib/content-agent';
import { createCampaignShell, buildOneAsset, type CampaignInput } from '@/lib/campaign-run';
import { sendToChannel } from '@/lib/distribution';
import { publishPaid, createMetaCampaign, type MetaTargeting } from '@/lib/distribution/paid';
import { fetchInsights } from '@/lib/insights';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', userId).limit(1).maybeSingle();
  if (mem?.workspace_id) return mem.workspace_id as string;
  const { data: wsId } = await supabase.rpc('create_workspace', { ws_name: 'הסביבה שלי' });
  return (wsId as string) ?? null;
}

// Create the campaign SHELL — pending asset per channel, no AI yet (fast). The UI
// then calls buildNextAsset repeatedly so channels build one at a time.
export async function createCampaign(input: CampaignInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  const res = await createCampaignShell(supabase, ws, input);
  if (res.id) revalidatePath('/campaigns');
  return res.id ? { ok: true, id: res.id, pending: res.pending } : { error: res.error };
}

// Build the NEXT pending channel of a campaign (one per call → progressive build).
export async function buildNextAsset(campaignId: string, variationsPerAngle = 6) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  const res = await buildOneAsset(supabase, ws, campaignId, variationsPerAngle);
  revalidatePath(`/campaigns/${campaignId}`);
  return res;
}

// Mark one variant as the A/B winner (clears the flag on its siblings in the same asset).
export async function setVariantWinner(variantId: string, assetId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  await supabase.from('content_variants').update({ is_winner: false }).eq('campaign_asset_id', assetId);
  const { error } = await supabase.from('content_variants').update({ is_winner: true }).eq('id', variantId);
  if (error) return { error: error.message };
  revalidatePath('/campaigns');
  return { ok: true };
}

// Campaign channel key → the distribution engine's Hebrew channel label.
const PUBLISH_LABEL: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם', linkedin: 'לינקדאין' };

// Publish a specific variant (usually the winner) to its channel via the shared
// distribution engine, and log a publications row.
export async function publishVariant(variantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };

  const { data: v } = await supabase.from('content_variants').select('channel, body').eq('id', variantId).maybeSingle();
  if (!v) return { error: 'variant_not_found' };
  const label = PUBLISH_LABEL[v.channel as string];
  if (!label) return { error: 'channel_not_publishable' }; // google_ads/seo are exported, not sent

  const { data: conn } = await supabase.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', label).maybeSingle();
  const res = await sendToChannel(label, (conn?.config ?? {}) as Record<string, unknown>, v.body as string);

  await supabase.from('publications').insert({
    workspace_id: ws, channel: label, content: v.body, variant_id: variantId, mode: 'organic',
    status: res.ok ? 'sent' : 'failed', external_id: res.externalId ?? null, error: res.error ?? null, sent_at: res.ok ? new Date().toISOString() : null,
  });
  return res.ok ? { ok: true } : { error: res.error };
}

// Publish MULTIPLE variants at once — the A/B way. Each selected variant goes out
// as its own post/creative. mode: 'organic' (content) | 'paid' (ממומן) | 'video'.
// mediaUrl attaches a video (for 'video', and optionally 'paid'). Works per platform.
export type PublishMode = 'organic' | 'paid' | 'video';
export async function publishVariants(input: { variantIds: string[]; mode: PublishMode; mediaUrl?: string; budget?: number }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  if (!input.variantIds.length) return { error: 'no_variants_selected' };
  if (input.mode === 'video' && !input.mediaUrl) return { error: 'video_requires_media' };

  const { data: variants } = await supabase.from('content_variants').select('id, channel, body, video_url').in('id', input.variantIds);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const v of variants ?? []) {
    const label = PUBLISH_LABEL[v.channel as string];
    if (!label) { results.push({ id: v.id as string, ok: false, error: 'channel_not_publishable' }); continue; }
    const { data: conn } = await supabase.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', label).maybeSingle();
    const baseConfig = (conn?.config ?? {}) as Record<string, unknown>;
    // Video source: the variant's own attached video (Video Studio) wins, else the batch mediaUrl.
    const videoUrl = (v.video_url as string | null) || input.mediaUrl;

    let res;
    if (input.mode === 'paid') {
      res = await publishPaid(label, baseConfig, v.body as string, { budget: input.budget, mediaUrl: videoUrl });
    } else {
      const config = videoUrl ? { ...baseConfig, video_url: videoUrl } : baseConfig;
      res = await sendToChannel(label, config, v.body as string);
    }

    await supabase.from('publications').insert({
      workspace_id: ws, channel: label, content: v.body, variant_id: v.id, mode: input.mode, media_url: videoUrl ?? null,
      status: res.ok ? 'sent' : 'failed', external_id: res.externalId ?? null, error: res.error ?? null, sent_at: res.ok ? new Date().toISOString() : null,
    });
    if (res.ok) await supabase.from('content_variants').update({ published: true, published_at: new Date().toISOString(), external_id: res.externalId ?? null }).eq('id', v.id);
    results.push({ id: v.id as string, ok: res.ok, error: res.error });
  }

  revalidatePath('/campaigns');
  const sent = results.filter((r) => r.ok).length;
  return { ok: true, sent, failed: results.length - sent, results };
}

// Launch a FULL Meta paid campaign — one Campaign + Ad Set (budget/targeting) +
// an Ad per selected variant (A/B). Created PAUSED; the user activates in Ads
// Manager. Stores the Meta ids on the asset and marks variants published.
export async function launchPaidCampaign(input: {
  assetId: string; variantIds: string[]; dailyBudget: number; objective?: string; link?: string; targeting?: MetaTargeting;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  if (!input.variantIds.length || !input.dailyBudget) return { error: 'variants_and_budget_required' };

  const { data: asset } = await supabase.from('campaign_assets').select('id, channel').eq('id', input.assetId).maybeSingle();
  const label = asset ? PUBLISH_LABEL[asset.channel as string] : null;
  if (label !== 'פייסבוק' && label !== 'אינסטגרם') return { error: 'paid_campaign_meta_only' };

  const { data: variants } = await supabase.from('content_variants').select('id, body, video_url').in('id', input.variantIds);
  const { data: conn } = await supabase.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', label).maybeSingle();

  const res = await createMetaCampaign((conn?.config ?? {}) as Record<string, unknown>, {
    name: `HELIX ${new Date().toISOString().slice(0, 10)}`,
    objective: input.objective, dailyBudget: input.dailyBudget, targeting: input.targeting, link: input.link,
    creatives: (variants ?? []).map((v) => ({ message: v.body as string, picture: (v.video_url as string) || undefined })),
  });
  if (!res.ok) return { error: res.error };

  await supabase.from('campaign_assets').update({ paid_campaign: { meta_campaign_id: res.campaignId, adset_id: res.adsetId, ad_ids: res.adIds } }).eq('id', input.assetId);
  // Map each variant to its ad id for later insights; mark published.
  const vlist = variants ?? [];
  for (let i = 0; i < vlist.length; i++) {
    await supabase.from('content_variants').update({ published: true, published_at: new Date().toISOString(), external_id: res.adIds?.[i] ?? null }).eq('id', vlist[i].id);
  }
  await supabase.from('publications').insert({ workspace_id: ws, channel: label, content: `Paid campaign (${res.adIds?.length ?? 0} ads)`, mode: 'paid', status: 'sent', external_id: res.campaignId ?? null, sent_at: new Date().toISOString() });

  revalidatePath('/campaigns');
  return { ok: true, campaignId: res.campaignId, ads: res.adIds?.length ?? 0 };
}

// Attach a video (from the Video Studio export) to a variant, for video posts.
export async function setVariantVideo(variantId: string, videoUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const { error } = await supabase.from('content_variants').update({ video_url: videoUrl.trim() || null }).eq('id', variantId);
  if (error) return { error: error.message };
  revalidatePath('/campaigns');
  return { ok: true };
}

// Pull REAL per-variant metrics (impressions/views/clicks) from each platform for
// every published variant in a campaign, and store them on content_variants. This
// is what powers "how many watched/clicked this variant" + performance-based winner.
const CH_LABEL: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם', linkedin: 'לינקדאין', tiktok: 'TikTok', youtube: 'YouTube' };
export async function syncCampaignMetrics(campaignId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };

  const { data: assetIds } = await supabase.from('campaign_assets').select('id').eq('campaign_id', campaignId);
  const { data: variants } = await supabase.from('content_variants')
    .select('id, channel, external_id').eq('published', true)
    .in('campaign_asset_id', assetIds?.map((a) => a.id) ?? ['00000000-0000-0000-0000-000000000000']);

  let updated = 0;
  const configCache = new Map<string, Record<string, unknown>>();
  for (const v of variants ?? []) {
    if (!v.external_id) continue;
    const label = CH_LABEL[v.channel as string] ?? (v.channel as string);
    let config = configCache.get(label);
    if (!config) {
      const { data: conn } = await supabase.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', label).maybeSingle();
      config = (conn?.config ?? {}) as Record<string, unknown>;
      configCache.set(label, config);
    }
    const m = await fetchInsights(label, config, v.external_id as string);
    if (!m) continue;
    await supabase.from('content_variants').update({
      impressions: m.impressions ?? 0, views: m.views ?? 0, clicks: m.clicks ?? 0, ...(m.conversions != null ? { conversions: m.conversions } : {}),
    }).eq('id', v.id);
    updated++;
  }
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, updated };
}

// Automatic A/B winner — pick by real performance if any exists (conversions>clicks>
// impressions), else fall back to the highest AI-humanness score. Sets is_winner.
export async function autoPickWinner(assetId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: variants } = await supabase.from('content_variants')
    .select('id, impressions, views, clicks, conversions, ai_score').eq('campaign_asset_id', assetId);
  if (!variants || variants.length === 0) return { error: 'no_variants' };

  const hasPerf = variants.some((v) => (v.clicks ?? 0) > 0 || (v.conversions ?? 0) > 0 || (v.impressions ?? 0) > 0 || (v.views ?? 0) > 0);
  const score = (v: typeof variants[number]) => hasPerf
    ? (v.conversions ?? 0) * 1000 + (v.clicks ?? 0) * 10 + (v.views ?? 0) * 1 + (v.impressions ?? 0) * 0.1
    : (v.ai_score ?? 0);
  const winner = variants.reduce((best, v) => (score(v) > score(best) ? v : best), variants[0]);

  await supabase.from('content_variants').update({ is_winner: false }).eq('campaign_asset_id', assetId);
  await supabase.from('content_variants').update({ is_winner: true }).eq('id', winner.id);
  revalidatePath('/campaigns');
  return { ok: true, winnerId: winner.id, basis: hasPerf ? 'performance' : 'ai_score' };
}

// Standalone A/B: up to 6 variants for a single channel/publication (no campaign).
export async function generateVariants(input: { title: string; brief: string; channel: string; angles?: number; n?: number }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  if (!input.title.trim() || !input.brief.trim()) return { error: 'missing_fields' };

  try {
    const variants = await generateChannelVariants(input.brief, input.title, input.channel, input.angles ?? 6, input.n ?? 6);
    const rows = variants.map((v) => ({
      workspace_id: ws, campaign_asset_id: null, channel: input.channel,
      variant_index: v.index, angle: v.angle, angle_index: v.angleIndex, variation_index: v.variationIndex,
      body: v.body, language: v.language, ai_score: v.aiScore,
    }));
    if (rows.length) await supabase.from('content_variants').insert(rows);
    return { ok: true, variants };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
