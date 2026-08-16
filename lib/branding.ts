import 'server-only';
import { createClient } from '@/lib/supabase/server';

// Per-workspace white-label branding for the current user's workspace, with agency
// inheritance: a client workspace with no branding of its own falls back to its
// parent agency's brand (parent_workspace_id, added in migration-v22). Empty object
// → the app's default HELIX brand. Fails soft so the nav always renders.
export type Branding = { brand_name?: string; logo_url?: string; primary_color?: string; footer?: string };

export async function getActiveBranding(): Promise<Branding> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data: mem } = await supabase
      .from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
    if (!mem?.workspace_id) return {};

    const { data: ws } = await supabase
      .from('workspaces').select('branding, parent_workspace_id').eq('id', mem.workspace_id).maybeSingle();
    let b = (ws?.branding as Branding) ?? {};
    if ((!b || Object.keys(b).length === 0) && ws?.parent_workspace_id) {
      const { data: p } = await supabase
        .from('workspaces').select('branding').eq('id', ws.parent_workspace_id).maybeSingle();
      b = (p?.branding as Branding) ?? {};
    }
    return b ?? {};
  } catch {
    return {};
  }
}
