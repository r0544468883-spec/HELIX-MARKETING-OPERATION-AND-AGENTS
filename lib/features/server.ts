import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  resolveFeatures,
  enabledFeatures,
  type FeatureId,
  type FeatureDef,
  type StoredFeatures,
} from '@/lib/features';

/**
 * Read the current user's workspace feature config from Supabase.
 * Falls back to `null` (→ every feature's default) when signed-out, workspace-less,
 * or the `features` column doesn't exist yet — so the nav keeps working exactly as
 * before until a workspace is explicitly given a lean/preset config.
 */
export async function getStoredFeatures(): Promise<StoredFeatures | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: mem } = await supabase
      .from('memberships')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (!mem?.workspace_id) return null;

    const { data: ws } = await supabase
      .from('workspaces')
      .select('features')
      .eq('id', mem.workspace_id)
      .maybeSingle();

    return (ws?.features as StoredFeatures) ?? null;
  } catch {
    // No Supabase / column not migrated yet — behave as "all defaults".
    return null;
  }
}

/** Enabled feature entries (nav order) for the current workspace. */
export async function getEnabledFeatures(): Promise<FeatureDef[]> {
  return enabledFeatures(await getStoredFeatures());
}

/** Full on/off map for the current workspace (for page-level guards). */
export async function getFeatureMap(): Promise<Record<FeatureId, boolean>> {
  return resolveFeatures(await getStoredFeatures());
}
