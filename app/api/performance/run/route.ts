import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runWorkspace } from '@/lib/performance/engine';

export const dynamic = 'force-dynamic';

// GET — the performance tick: score every workspace's creatives and record/apply
// decisions. Wire to a Vercel Cron (e.g. hourly). Protected by DIGEST_SECRET.
// Only workspaces that actually have creatives are processed.
export async function GET(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const provided = new URL(req.url).searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data } = await admin.from('creatives').select('workspace_id').limit(5000);
  const ids = Array.from(new Set((data ?? []).map((r) => r.workspace_id as string)));

  let recorded = 0;
  let applied = 0;
  for (const ws of ids) {
    const r = await runWorkspace(admin, ws);
    recorded += r.recorded;
    applied += r.applied;
  }
  return NextResponse.json({ workspaces: ids.length, recorded, applied });
}
