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

async function authedWorkspace(supabase: SupabaseServer): Promise<string | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  return ws;
}

export type FunnelInput = {
  channel: string;
  post_url?: string;
  post_id?: string;
  keyword: string;
  public_reply_text: string;
  dm_message: string;
  tier?: 'compliant' | 'risk';
};

// Create a Comment-to-DM funnel.
export async function createFunnel(input: FunnelInput) {
  const supabase = await createClient();
  const ws = await authedWorkspace(supabase);
  if (typeof ws !== 'string') return ws;

  const { error } = await supabase.from('comment_funnels').insert({
    workspace_id: ws,
    channel: input.channel,
    post_url: input.post_url || null,
    post_id: input.post_id || null,
    keyword: input.keyword,
    public_reply_text: input.public_reply_text,
    dm_message: input.dm_message,
    tier: input.tier ?? 'compliant',
  });
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function setFunnelActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from('comment_funnels').update({ active }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// HITL — approve/reject a suggested engagement action.
export async function approveEngagementAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('engagement_actions')
    .update({ status: 'approved' })
    .eq('id', id)
    .eq('status', 'suggested');
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function rejectEngagementAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('engagement_actions')
    .update({ status: 'skipped' })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// Kill-switch — pause/resume engagement for a channel (or all channels).
export async function setKillSwitch(channel: string | null, paused: boolean) {
  const supabase = await createClient();
  const ws = await authedWorkspace(supabase);
  if (typeof ws !== 'string') return ws;

  let q = supabase.from('engagement_limits').update({ paused }).eq('workspace_id', ws);
  if (channel) q = q.eq('channel', channel);
  const { error } = await q;
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// Explicit risk consent for a gray channel (LinkedIn/Meta browser automation).
export async function giveRiskConsent(channel: string) {
  const supabase = await createClient();
  const ws = await authedWorkspace(supabase);
  if (typeof ws !== 'string') return ws;

  const { error } = await supabase
    .from('risk_consents')
    .upsert(
      { workspace_id: ws, channel, consent_text_version: 'v1' },
      { onConflict: 'workspace_id,channel' }
    );
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// Toggle auto-reply on a DM thread.
export async function setThreadAutoReply(threadId: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('dm_threads')
    .update({ auto_reply_enabled: enabled })
    .eq('id', threadId);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}
