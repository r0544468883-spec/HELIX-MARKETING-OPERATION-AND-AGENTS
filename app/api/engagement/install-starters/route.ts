import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { installStarterFunnels } from '@/lib/engagement/funnel-catalog';

export const dynamic = 'force-dynamic';

// Seed the starter comment-funnel catalog into a workspace.
// POST ?secret=DIGEST_SECRET&workspace=<uuid>  (or JSON body { workspace }).
// Protect with the same DIGEST_SECRET used by the other engagement routes.
export async function POST(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const url = new URL(req.url);
  const provided = url.searchParams.get('secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { workspace?: string };
  const ws = url.searchParams.get('workspace') ?? body.workspace;
  if (!ws) return NextResponse.json({ error: 'workspace_required' }, { status: 400 });

  try {
    const result = await installStarterFunnels(admin, ws);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'install_failed' }, { status: 500 });
  }
}
