import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { workspaceIdByToken, listContent } from '@/lib/headless/store';

export const dynamic = 'force-dynamic';

// Developer API — PULL feed. A customer's headless site (Next/Astro/Vue/…) GETs its
// published content as typed JSON, authenticated by the workspace's content_api_token
// (header `x-helix-api-key` or `?token=`). ISR-friendly: pass `?since=<ISO>` for
// incremental fetches; responses carry a short s-maxage so builds/ISR can cache.
//   GET /api/content?token=…&since=…&status=published&limit=100
export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const url = new URL(req.url);
  const token = req.headers.get('x-helix-api-key') || url.searchParams.get('token') || '';
  const workspaceId = await workspaceIdByToken(admin, token);
  if (!workspaceId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const status = (url.searchParams.get('status') as 'published' | 'draft' | 'all' | null) ?? 'published';
  const since = url.searchParams.get('since') ?? undefined;
  const limit = Number(url.searchParams.get('limit')) || undefined;

  const items = await listContent(admin, workspaceId, { status, since, limit });
  return NextResponse.json(
    { ok: true, count: items.length, items },
    { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  );
}
