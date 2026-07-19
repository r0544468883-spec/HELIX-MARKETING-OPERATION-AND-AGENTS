'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { generateComment } from '@/lib/engagement/engage-agent';

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

export type RadarInput = {
  name: string;
  keywords: string[];
  icp?: string;
  min_intent?: number;
  alert_channels: string[];
  sources?: { type: string; id: string }[];
};

export async function createRadar(input: RadarInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };

  const { error } = await supabase.from('radar_configs').insert({
    workspace_id: ws,
    name: input.name,
    keywords: input.keywords,
    icp: input.icp || null,
    min_intent: input.min_intent ?? 0.7,
    alert_channels: input.alert_channels,
    sources: input.sources ?? [],
  });
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function setRadarActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from('radar_configs').update({ active }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function setLeadStatus(id: string, status: 'new' | 'contacted' | 'saved' | 'dismissed') {
  const supabase = await createClient();
  const { error } = await supabase.from('radar_leads').update({ status }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/');
  return { ok: true };
}

// Hand a radar lead to the engagement engine: draft an outreach comment and
// queue it as a suggested action (HITL). The lead is marked 'contacted'.
export async function convertLeadToEngagement(leadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };

  const { data: lead } = await supabase
    .from('radar_leads')
    .select('source, post_url, content')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return { error: 'lead_not_found' };

  const draft = await generateComment(
    (lead.content as string) ?? '',
    'פנייה אישית ומועילה, בלי קידום בוטה.'
  ).catch(() => '');

  const { data: target } = await supabase
    .from('engagement_targets')
    .insert({
      workspace_id: ws,
      channel: 'פייסבוק',
      source: 'group',
      post_url: (lead.post_url as string) ?? null,
      content: (lead.content as string) ?? null,
      decision: 'comment',
    })
    .select('id')
    .single();

  const { error } = await supabase.from('engagement_actions').insert({
    workspace_id: ws,
    channel: 'פייסבוק',
    target_id: target?.id ?? null,
    type: 'comment',
    content: draft,
    status: 'suggested',
  });
  if (error) return { error: error.message };

  await supabase.from('radar_leads').update({ status: 'contacted' }).eq('id', leadId);
  revalidatePath('/');
  return { ok: true };
}
