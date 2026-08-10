// OPS binding of the autonomy switch. Uses the request-scoped server client
// (server actions run with the user's session; RLS scopes by membership).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutonomyStore } from './resolve';
import type { AutonomyMode } from './types';

export function serverStore(supabase: SupabaseClient): AutonomyStore {
  return {
    async getSettings(workspaceId, featureKey) {
      const { data } = await supabase
        .from('autonomy_settings')
        .select('mode, risk_ack')
        .eq('workspace_id', workspaceId)
        .eq('feature_key', featureKey)
        .maybeSingle();
      return (data as { mode: AutonomyMode; risk_ack: boolean } | null) ?? null;
    },
  };
}
