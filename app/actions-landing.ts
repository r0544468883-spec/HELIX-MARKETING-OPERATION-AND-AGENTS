'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { templateByKey } from '@/lib/landing/templates';
import { fillLandingContent } from '@/lib/landing/generate';
import type { Section, UxStyle } from '@/lib/landing/types';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', userId).limit(1).maybeSingle();
  if (mem?.workspace_id) return mem.workspace_id as string;
  const { data: wsId } = await supabase.rpc('create_workspace', { ws_name: 'הסביבה שלי' });
  return (wsId as string) ?? null;
}
function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^\w֐-׿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'lp';
}

// Create a landing page from a template (optionally AI-fill from a campaign brief).
export async function createLanding(input: { templateKey: string; name: string; campaignId?: string; aiFill?: boolean }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  const tpl = templateByKey(input.templateKey);
  if (!tpl) return { error: 'no_template' };

  let sections: Section[] = tpl.sections;
  if (input.aiFill && input.campaignId) {
    const { data: camp } = await supabase.from('campaigns').select('brief, client_profile').eq('id', input.campaignId).maybeSingle();
    const brief = [camp?.brief, JSON.stringify(camp?.client_profile ?? {})].filter(Boolean).join('\n');
    if (brief) sections = await fillLandingContent(tpl.sections, brief);
  }

  const slug = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase.from('landing_pages')
    .insert({ workspace_id: ws, campaign_id: input.campaignId ?? null, name: input.name.trim(), slug, template: tpl.key, vertical: tpl.vertical, ux_style: tpl.ux_style, sections, published: false })
    .select('id').single();
  if (error) return { error: error.message };
  revalidatePath('/landing');
  return { ok: true, id: data!.id, slug };
}

export async function updateLandingSections(id: string, sections: Section[]) {
  const supabase = await createClient();
  const { error } = await supabase.from('landing_pages').update({ sections, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/landing');
  return { ok: true };
}

export async function setLandingStyle(id: string, ux_style: UxStyle) {
  const supabase = await createClient();
  const { error } = await supabase.from('landing_pages').update({ ux_style }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/landing');
  return { ok: true };
}

export async function publishLanding(id: string, published: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from('landing_pages').update({ published }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/landing');
  return { ok: true };
}

// AI-fill an existing page from free text.
export async function aiFillLanding(id: string, brief: string) {
  const supabase = await createClient();
  const { data: lp } = await supabase.from('landing_pages').select('sections').eq('id', id).maybeSingle();
  if (!lp) return { error: 'not_found' };
  const filled = await fillLandingContent((lp.sections ?? []) as Section[], brief);
  await supabase.from('landing_pages').update({ sections: filled }).eq('id', id);
  revalidatePath('/landing');
  return { ok: true, sections: filled };
}
