// Shared campaign build+persist — called by BOTH the app server action and the
// bot router (which passes an admin client). Kept out of the 'use server' file so
// it can accept a Supabase client argument. This is what makes campaigns
// bot-accessible with the same logic as the UI.
import { buildCampaign, type CampaignAsset, type ClientProfile, type Budget } from './campaign-agent';

// Minimal client shape we use (server or admin client both satisfy it).
type Db = {
  from: (t: string) => {
    insert: (v: unknown) => { select: (c: string) => { single: () => PromiseLike<{ data: { id: string } | null; error: { message: string } | null }> } } & PromiseLike<{ error: { message: string } | null }>;
  };
};

export type CampaignInput = {
  name: string; goal?: string; brief: string; channels: string[];
  clientProfile?: ClientProfile; budget?: Budget; variantsPerChannel?: number; source?: 'app' | 'bot';
};

function assetPayload(asset: CampaignAsset): Record<string, unknown> {
  if (asset.kind === 'search_ads') return { rsa: asset.rsa };
  if (asset.kind === 'seo') return { plan: asset.plan };
  return {};
}

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
      .insert({ campaign_id: camp.id, workspace_id: ws, channel, kind: asset.kind, budget, payload: assetPayload(asset) })
      .select('id').single();
    if (asset.kind === 'social' && ca) {
      const rows = asset.variants.map((v) => ({
        workspace_id: ws, campaign_asset_id: ca.id, channel, variant_index: v.index,
        angle: v.angle, body: v.body, language: v.language, ai_score: v.aiScore,
      }));
      if (rows.length) await db.from('content_variants').insert(rows);
    }
  }

  return { ok: true, id: camp.id, result };
}
