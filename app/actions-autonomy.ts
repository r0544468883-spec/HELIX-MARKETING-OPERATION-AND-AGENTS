'use server';

import { createClient } from '@/lib/supabase/server';
import type { AutonomyMode } from '@/lib/autonomy/types';

async function currentWorkspace(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  return (data?.workspace_id as string) ?? null;
}

export async function setAutonomyMode(featureKey: string, mode: AutonomyMode, riskAck: boolean): Promise<{ ok?: boolean; error?: string }> {
  const ws = await currentWorkspace();
  if (!ws) return { error: 'no_workspace' };
  const supabase = await createClient();
  const { error } = await supabase.from('autonomy_settings').upsert(
    { workspace_id: ws, feature_key: featureKey, mode, risk_ack: riskAck, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,feature_key' },
  );
  return error ? { error: error.message } : { ok: true };
}
