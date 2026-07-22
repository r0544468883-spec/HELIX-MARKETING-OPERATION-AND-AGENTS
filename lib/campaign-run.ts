// Campaign build+persist. Two paths:
//  • runCampaign        — one-shot full build (used by the bot for a summary reply)
//  • createCampaignShell + buildOneAsset — INCREMENTAL: create the campaign with
//    pending per-channel assets, then build ONE channel per call so results appear
//    progressively (never 108 variants at once). Shared by app + bot.
import { buildCampaign, buildChannelContent, assetKind, personaBrief, allocate, type CampaignAsset, type ClientProfile, type Budget } from './campaign-agent';

type Db = {
  from: (t: string) => {
    insert: (v: unknown) => { select: (c: string) => { single: () => PromiseLike<{ data: { id: string } | null; error: { message: string } | null }> } } & PromiseLike<{ error: { message: string } | null }>;
    select: (c: string) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => { maybeSingle: () => PromiseLike<{ data: AssetRow | null }> } } };
        maybeSingle: () => PromiseLike<{ data: CampRow | null }>;
      };
    };
    update: (v: unknown) => { eq: (k: string, val: string) => PromiseLike<{ error: unknown }> };
  };
};
type AssetRow = { id: string; channel: string; kind: string; budget: number | null };
type CampRow = { brief: string | null; client_profile: ClientProfile | null };

export type CampaignInput = {
  name: string; goal?: string; brief: string; channels: string[];
  clientProfile?: ClientProfile; budget?: Budget; variantsPerChannel?: number; source?: 'app' | 'bot';
};

function assetPayload(asset: CampaignAsset): Record<string, unknown> {
  if (asset.kind === 'search_ads') return { rsa: asset.rsa };
  if (asset.kind === 'seo') return { plan: asset.plan };
  return {};
}

async function persistAsset(db: Db, ws: string, assetId: string, asset: CampaignAsset) {
  await db.from('campaign_assets').update({ status: 'ready', kind: asset.kind, payload: assetPayload(asset) }).eq('id', assetId);
  if (asset.kind === 'social') {
    const rows = asset.variants.map((v) => ({
      workspace_id: ws, campaign_asset_id: assetId, channel: asset.channel, variant_index: v.index,
      angle: v.angle, angle_index: v.angleIndex, variation_index: v.variationIndex,
      body: v.body, language: v.language, ai_score: v.aiScore,
    }));
    if (rows.length) await db.from('content_variants').insert(rows);
  }
}

// INCREMENTAL — create the campaign + one pending asset per channel (fast, no AI).
export async function createCampaignShell(client: unknown, ws: string, input: CampaignInput): Promise<{ id?: string; error?: string; pending?: number }> {
  if (!input.name.trim() || !input.brief.trim() || input.channels.length === 0) return { error: 'missing_fields' };
  const db = client as Db;
  const alloc = allocate(input.channels, input.budget);

  const { data: camp, error } = await db.from('campaigns')
    .insert({ workspace_id: ws, name: input.name.trim(), goal: input.goal ?? null, brief: input.brief.trim(), channels: input.channels, client_profile: input.clientProfile ?? {}, budget: input.budget ?? {}, status: 'building', source: input.source ?? 'app' })
    .select('id').single();
  if (error || !camp) return { error: error?.message ?? 'insert_failed' };

  for (const channel of input.channels) {
    await db.from('campaign_assets').insert({ campaign_id: camp.id, workspace_id: ws, channel, kind: assetKind(channel), budget: alloc[channel], status: 'pending', payload: {} });
  }
  return { id: camp.id, pending: input.channels.length };
}

// INCREMENTAL — build the next pending channel for a campaign (one per call).
export async function buildOneAsset(client: unknown, ws: string, campaignId: string, variationsPerAngle = 6): Promise<{ done?: boolean; channel?: string; remaining?: number; error?: string }> {
  const db = client as Db;
  const { data: asset } = await db.from('campaign_assets').select('id, channel, kind, budget').eq('campaign_id', campaignId).eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!asset) {
    await db.from('campaigns').update({ status: 'ready' }).eq('id', campaignId);
    return { done: true, remaining: 0 };
  }
  const { data: camp } = await db.from('campaigns').select('brief, client_profile').eq('id', campaignId).maybeSingle();
  const brief = personaBrief(camp?.brief ?? '', camp?.client_profile ?? undefined);

  try {
    const content = await buildChannelContent(asset.channel, brief, 'קמפיין', variationsPerAngle);
    await persistAsset(db, ws, asset.id, content);
  } catch (e) {
    return { error: (e as Error).message };
  }
  // Count remaining pending (best-effort via another query would need count; return channel).
  return { done: false, channel: asset.channel };
}

// ONE-SHOT (bot path) — build all channels now and return the structured result.
export async function runCampaign(client: unknown, ws: string, input: CampaignInput): Promise<{ ok?: boolean; id?: string; error?: string; result?: Awaited<ReturnType<typeof buildCampaign>> }> {
  if (!input.name.trim() || !input.brief.trim() || input.channels.length === 0) return { error: 'missing_fields' };
  const db = client as Db;

  let result;
  try {
    result = await buildCampaign({ brief: input.brief, title: input.name, channels: input.channels, clientProfile: input.clientProfile, budget: input.budget, variantsPerChannel: input.variantsPerChannel });
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { data: camp, error: cErr } = await db.from('campaigns')
    .insert({ workspace_id: ws, name: input.name.trim(), goal: input.goal ?? null, brief: input.brief.trim(), channels: input.channels, client_profile: input.clientProfile ?? {}, budget: input.budget ?? {}, status: 'ready', source: input.source ?? 'app' })
    .select('id').single();
  if (cErr || !camp) return { error: cErr?.message ?? 'insert_failed' };

  for (const { channel, asset, budget } of result) {
    const { data: ca } = await db.from('campaign_assets')
      .insert({ campaign_id: camp.id, workspace_id: ws, channel, kind: asset.kind, budget, status: 'ready', payload: assetPayload(asset) })
      .select('id').single();
    if (ca) await persistAsset(db, ws, ca.id, asset);
  }
  return { ok: true, id: camp.id, result };
}
