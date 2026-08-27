'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Current user's workspace (first membership). Mirrors actions-performance.ts. */
async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return (mem?.workspace_id as string) ?? null;
}

export const DEAL_STAGES = ['proposed', 'negotiating', 'approved', 'live', 'ended'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export type PublisherDeal = {
  id: string;
  publisher: string;
  stage: DealStage;
  deal_type: 'io' | 'pmp' | 'pg' | 'preferred';
  unit: 'cpm' | 'cpd' | 'fixed';
  rate: number;
  guaranteed_impressions: number;
  deal_id: string | null;
  deadline: string | null;
  contact_name: string | null;
  contact_email: string | null;
  invoice_status: 'none' | 'received' | 'paid';
  notes: string | null;
  client_id: string | null;
  created_at: string;
};

export type NewDealInput = {
  publisher: string;
  deal_type?: PublisherDeal['deal_type'];
  unit?: PublisherDeal['unit'];
  rate?: number;
  guaranteed_impressions?: number;
  deadline?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  client_id?: string | null;
  notes?: string | null;
};

/** All publisher deals for the current workspace (RLS also scopes agency admins to clients). */
export async function listPublisherDeals(): Promise<PublisherDeal[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return [];
  const { data } = await supabase
    .from('publisher_deals')
    .select(
      'id, publisher, stage, deal_type, unit, rate, guaranteed_impressions, deal_id, deadline, contact_name, contact_email, invoice_status, notes, client_id, created_at',
    )
    .eq('workspace_id', ws)
    .order('created_at', { ascending: false });
  return (data ?? []) as PublisherDeal[];
}

export async function createPublisherDeal(input: NewDealInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  if (!input.publisher?.trim()) return { error: 'publisher_required' };

  const { error } = await supabase.from('publisher_deals').insert({
    workspace_id: ws,
    publisher: input.publisher.trim(),
    deal_type: input.deal_type ?? 'io',
    unit: input.unit ?? 'cpm',
    rate: input.rate ?? 0,
    guaranteed_impressions: input.guaranteed_impressions ?? 0,
    deadline: input.deadline || null,
    contact_name: input.contact_name?.trim() || null,
    contact_email: input.contact_email?.trim() || null,
    client_id: input.client_id || null,
    notes: input.notes?.trim() || null,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/[locale]/media-buying/deals', 'page');
  return { ok: true };
}

/** Advance/move a deal to a stage (kanban). Validates the stage server-side. */
export async function setDealStage(id: string, stage: DealStage) {
  if (!DEAL_STAGES.includes(stage)) return { error: 'bad_stage' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  const { error } = await supabase
    .from('publisher_deals')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', ws);
  if (error) return { error: error.message };
  revalidatePath('/[locale]/media-buying/deals', 'page');
  return { ok: true };
}

export async function setDealInvoiceStatus(id: string, invoice_status: PublisherDeal['invoice_status']) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };
  const { error } = await supabase
    .from('publisher_deals')
    .update({ invoice_status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', ws);
  if (error) return { error: error.message };
  revalidatePath('/[locale]/media-buying/deals', 'page');
  return { ok: true };
}
