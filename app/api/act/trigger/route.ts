// POST /api/act/trigger — cross-product hook (Phase 4). Lets the HELIX Dashboards
// hub kick OPS to run its performance tick. Secret-gated (x-cross-act-secret).
// SAFETY: runWorkspace applies OPS's OWN switch (execution_mode/autonomy), so this
// only records decisions unless the workspace opted into connector+autopilot.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runWorkspace } from '@/lib/performance/engine';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.CROSS_ACT_SECRET;
  if (!secret || req.headers.get('x-cross-act-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 503 });

  const { data } = await admin.from('creatives').select('workspace_id').limit(5000);
  const ids = Array.from(new Set((data ?? []).map((r) => r.workspace_id as string)));
  let recorded = 0;
  let applied = 0;
  for (const ws of ids) {
    const r = await runWorkspace(admin, ws);
    recorded += r.recorded;
    applied += r.applied;
  }
  return NextResponse.json({ ok: true, workspaces: ids.length, recorded, applied });
}
