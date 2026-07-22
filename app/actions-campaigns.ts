'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateChannelVariants } from '@/lib/content-agent';
import { runCampaign, type CampaignInput } from '@/lib/campaign-run';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', userId).limit(1).maybeSingle();
  if (mem?.workspace_id) return mem.workspace_id as string;
  const { data: wsId } = await supabase.rpc('create_workspace', { ws_name: 'הסביבה שלי' });
  return (wsId as string) ?? null;
}

// Build a full cross-channel campaign (FB/IG/LinkedIn/Google Ads/SEO), persisting
// campaign + per-channel assets + up to 6 A/B variants each.
export async function createCampaign(input: CampaignInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  const res = await runCampaign(supabase, ws, input);
  if (res.ok) revalidatePath('/campaigns');
  return res.ok ? { ok: true, id: res.id } : { error: res.error };
}

// Standalone A/B: up to 6 variants for a single channel/publication (no campaign).
export async function generateVariants(input: { title: string; brief: string; channel: string; n?: number }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  if (!input.title.trim() || !input.brief.trim()) return { error: 'missing_fields' };

  try {
    const variants = await generateChannelVariants(input.brief, input.title, input.channel, input.n ?? 6);
    const rows = variants.map((v) => ({
      workspace_id: ws, campaign_asset_id: null, channel: input.channel,
      variant_index: v.index, angle: v.angle, body: v.body, language: v.language, ai_score: v.aiScore,
    }));
    if (rows.length) await supabase.from('content_variants').insert(rows);
    return { ok: true, variants };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
