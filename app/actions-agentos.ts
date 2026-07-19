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

export type AgentInput = {
  name: string;
  type?: string;
  system?: string;
  prompt?: string;
  channels: string[];
  model_tier?: 'local' | 'quality' | 'auto';
};

export async function createAgent(input: AgentInput) {
  const supabase = await createClient();
  const ws = await authedWs(supabase);
  if (typeof ws !== 'string') return ws;

  const { error } = await supabase.from('agents').insert({
    workspace_id: ws,
    name: input.name,
    type: input.type ?? 'prompt',
    config: { system: input.system ?? '', prompt: input.prompt ?? '', channels: input.channels },
    model_tier: input.model_tier ?? 'auto',
  });
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function setAgentActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from('agents').update({ active }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// Configure the workspace's Ollama endpoint (managed shared, or the customer's local).
export async function setOllamaEndpoint(input: {
  mode: 'shared' | 'local';
  base_url: string;
  model?: string;
  api_key?: string;
}) {
  const supabase = await createClient();
  const ws = await authedWs(supabase);
  if (typeof ws !== 'string') return ws;

  const { error } = await supabase.from('ollama_endpoints').upsert(
    {
      workspace_id: ws,
      mode: input.mode,
      base_url: input.base_url,
      model: input.model || 'qwen3.5:4b',
      api_key: input.api_key || null,
    },
    { onConflict: 'workspace_id' }
  );
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}
