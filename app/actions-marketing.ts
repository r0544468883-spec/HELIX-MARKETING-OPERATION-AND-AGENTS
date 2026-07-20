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

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, ws: null as string | null, error: 'unauthorized' as const };
  const ws = await currentWorkspace(supabase, user.id);
  return { supabase, ws, error: ws ? null : ('no_workspace' as const) };
}

// Create an email sequence with its steps in one shot.
export async function createSequence(input: {
  name: string;
  steps: { delay_hours: number; email_subject: string; email_body: string }[];
}) {
  const { supabase, ws, error } = await authed();
  if (error) return { error };
  if (!input.name.trim() || input.steps.length === 0) return { error: 'name_and_steps_required' };

  const { data: seq, error: seqErr } = await supabase
    .from('mkt_sequences').insert({ workspace_id: ws, name: input.name.trim(), status: 'active' })
    .select('id').single();
  if (seqErr) return { error: seqErr.message };

  const rows = input.steps.map((s, i) => ({
    sequence_id: seq!.id,
    step_order: i + 1,
    delay_hours: s.delay_hours,
    email_subject: s.email_subject,
    email_body: s.email_body,
  }));
  const { error: stepErr } = await supabase.from('mkt_sequence_steps').insert(rows);
  if (stepErr) return { error: stepErr.message };

  revalidatePath('/');
  return { ok: true, id: seq!.id };
}

export async function setSequenceStatus(id: string, status: 'active' | 'paused') {
  const { supabase, error } = await authed();
  if (error) return { error };
  const { error: e } = await supabase.from('mkt_sequences').update({ status }).eq('id', id);
  if (e) return { error: e.message };
  revalidatePath('/');
  return { ok: true };
}

// Enroll a contact (by email) into a sequence — creates the contact if needed.
export async function enrollContact(input: { sequence_id: string; email: string; first_name?: string }) {
  const { supabase, ws, error } = await authed();
  if (error) return { error };
  const email = input.email.toLowerCase().trim();
  if (!email.includes('@')) return { error: 'invalid_email' };

  const { data: existing } = await supabase
    .from('mkt_contacts').select('id').eq('workspace_id', ws).eq('email', email).maybeSingle();
  let contactId = existing?.id as string | undefined;
  if (!contactId) {
    const { data: created, error: cErr } = await supabase
      .from('mkt_contacts').insert({ workspace_id: ws, email, first_name: input.first_name ?? null, tags: ['lead'] })
      .select('id').single();
    if (cErr) return { error: cErr.message };
    contactId = created!.id;
  }

  const { error: enErr } = await supabase.from('mkt_sequence_enrollments').insert({
    sequence_id: input.sequence_id, contact_id: contactId, status: 'active', current_step: 1, next_send_at: new Date().toISOString(),
  });
  if (enErr) return { error: enErr.message };
  revalidatePath('/');
  return { ok: true };
}
