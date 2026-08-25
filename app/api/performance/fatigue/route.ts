import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { scanWorkspaceFatigue } from '@/lib/performance/engine';

export const dynamic = 'force-dynamic';

// GET — creative-fatigue scan (ops-creative-fatigue-scanner skill). READ-ONLY: reads the
// creative_metrics time-series and returns a ranked findings list. It NEVER pauses, edits,
// or records a decision — the operator (or the autonomy gate) acts on the findings. Pass a
// single ?workspace=<id> to scan one workspace; omit it to scan every workspace that has
// live creatives (cron use). Protected by DIGEST_SECRET.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.DIGEST_SECRET;
  const provided = url.searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const one = url.searchParams.get('workspace');
  const ids = one
    ? [one]
    : Array.from(
        new Set(
          (
            (await admin.from('creatives').select('workspace_id').eq('status', 'live').limit(5000)).data ?? []
          ).map((r) => r.workspace_id as string)
        )
      );

  const results = [];
  let flagged = 0;
  for (const ws of ids) {
    const findings = await scanWorkspaceFatigue(admin, ws);
    const fatigued = findings.filter((f) => f.verdict.status === 'fatigued');
    flagged += fatigued.length;
    results.push({ workspace: ws, reviewed: findings.length, fatigued: fatigued.length, findings });
  }
  return NextResponse.json({ workspaces: ids.length, flagged, results });
}
