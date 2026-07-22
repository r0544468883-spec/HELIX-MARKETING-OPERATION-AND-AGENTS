'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { resolveAvatarKey, submitAvatar, type AvatarProvider } from '@/lib/avatar';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', userId).limit(1).maybeSingle();
  return (mem?.workspace_id as string) ?? null;
}

// Generate an avatar video for a variant — IN-SYSTEM (HELIX calls the provider API).
// Hybrid: the customer's own key (BYOK) or HELIX's managed key. Async — a poll cron
// fills content_variants.video_url when the render finishes.
export async function generateVariantAvatar(input: { variantId: string; provider: AvatarProvider; avatarId?: string; voiceId?: string; avatarImage?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };

  const { data: v } = await supabase.from('content_variants').select('id, body').eq('id', input.variantId).maybeSingle();
  if (!v) return { error: 'variant_not_found' };

  // Key: BYOK from the workspace's avatar config, else HELIX managed.
  const { data: conn } = await supabase.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', 'avatar').maybeSingle();
  const { key, managed } = resolveAvatarKey((conn?.config ?? {}) as Record<string, string>, input.provider);
  if (!key) return { error: 'avatar_key_missing' }; // no BYOK and no managed key configured

  try {
    const externalId = await submitAvatar(input.provider, key, { script: v.body as string, avatarId: input.avatarId, voiceId: input.voiceId, avatarImage: input.avatarImage });
    await supabase.from('avatar_jobs').insert({ workspace_id: ws, variant_id: v.id, provider: input.provider, external_id: externalId, status: 'processing', managed });
    if (managed) await supabase.from('avatar_usage').insert({ workspace_id: ws, provider: input.provider, units: 1 });
    revalidatePath('/campaigns');
    return { ok: true, message: 'הסרטון בהפקה — יופיע על הגרסה עוד כדקה-שתיים.' };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
