import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// POST — ingest live metrics for a creative (the client's own data, brain OR connector
// mode). Whoever collects platform stats (the client's "local solution", a poller, or
// the extension) posts a snapshot here; the engine reads the newest per creative.
// Auth: shared EXTENSION_SECRET (same as the other ingest endpoints).
export async function POST(req: Request) {
  if (req.headers.get('x-ext-secret') !== process.env.EXTENSION_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as {
    workspace?: string;
    creative_id?: string;
    platform?: string;
    spend?: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    revenue?: number;
  };
  if (!b.workspace || !b.creative_id) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { error } = await admin.from('creative_metrics').insert({
    workspace_id: b.workspace,
    creative_id: b.creative_id,
    platform: b.platform ?? null,
    spend: b.spend ?? 0,
    impressions: b.impressions ?? 0,
    clicks: b.clicks ?? 0,
    conversions: b.conversions ?? 0,
    revenue: b.revenue ?? 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
