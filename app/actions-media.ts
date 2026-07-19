'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (mem?.workspace_id) return mem.workspace_id as string;
  const { data: wsId } = await supabase.rpc('create_workspace', { ws_name: 'הסביבה שלי' });
  return (wsId as string) ?? null;
}

async function authedWs(supabase: SupabaseServer): Promise<string | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  return ws;
}

export async function createClientProfile(input: {
  name: string;
  audience?: string;
  voice?: string;
  dos_donts?: string;
  lang?: 'he' | 'en' | 'both';
}) {
  const supabase = await createClient();
  const ws = await authedWs(supabase);
  if (typeof ws !== 'string') return ws;

  const { error } = await supabase.from('client_profiles').insert({
    workspace_id: ws,
    name: input.name,
    audience: input.audience || null,
    voice: input.voice || null,
    dos_donts: input.dos_donts || null,
    lang: input.lang ?? 'he',
  });
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// Register a media asset for the Auto-Ingest agent to caption + schedule.
export async function registerMediaAsset(input: {
  client_id?: string;
  asset_ref: string;
  title?: string;
  description?: string;
  topic?: string;
  storage_path?: string;
  target_networks: string[];
  priority?: number;
  scheduled_at?: string;
}) {
  const supabase = await createClient();
  const ws = await authedWs(supabase);
  if (typeof ws !== 'string') return ws;

  const { error } = await supabase.from('media_assets').insert({
    workspace_id: ws,
    client_id: input.client_id || null,
    asset_ref: input.asset_ref,
    title: input.title || null,
    description: input.description || null,
    topic: input.topic || null,
    storage_path: input.storage_path || null,
    target_networks: input.target_networks,
    priority: input.priority ?? 3,
    scheduled_at: input.scheduled_at || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}
