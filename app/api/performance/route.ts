import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recomputeInsights } from '@/lib/agentos/learning';

export const dynamic = 'force-dynamic';

// POST — ingest a performance metric for a published post (per network).
// Called by a metrics collector (network API poller or the browser extension).
// Auto-fetching reach/engagement from each network needs that network's API
// tokens — this endpoint stores whatever the collector supplies.
export async function POST(req: Request) {
  if (req.headers.get('x-ext-secret') !== process.env.EXTENSION_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as {
    workspace?: string;
    publication_id?: string;
    asset_id?: string;
    network?: string;
    reach?: number;
    impressions?: number;
    engagement?: number;
    clicks?: number;
  };
  if (!b.workspace || !b.network) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  await admin.from('post_performance').insert({
    workspace_id: b.workspace,
    publication_id: b.publication_id ?? null,
    asset_id: b.asset_id ?? null,
    network: b.network,
    reach: b.reach ?? null,
    impressions: b.impressions ?? null,
    engagement: b.engagement ?? null,
    clicks: b.clicks ?? null,
  });
  return NextResponse.json({ ok: true });
}

// GET — the Learning Loop tick: recompute best-hour insights per workspace
// from accumulated performance. Wire to a weekly Vercel Cron; protect with secret.
export async function GET(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const provided = new URL(req.url).searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data: workspaces } = await admin
    .from('post_performance')
    .select('workspace_id')
    .limit(1000);
  const ids = Array.from(new Set((workspaces ?? []).map((w) => w.workspace_id as string)));

  let updated = 0;
  for (const ws of ids) updated += await recomputeInsights(admin, ws);
  return NextResponse.json({ workspaces: ids.length, insights_updated: updated });
}
