import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildReport, renderReportHtml } from '@/lib/performance/report';

// Public, read-only white-label report. An agency shares this link with their client;
// no login. The report_token on the workspace is the capability — anyone with the link
// sees that workspace's performance report. Uses the service-role client to bypass RLS
// (the token IS the auth). ?days=30 controls the window.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createAdminClient();
  if (!db) return new NextResponse('report unavailable', { status: 503 });

  const { data: ws } = await db.from('workspaces').select('id').eq('report_token', token).maybeSingle();
  if (!ws?.id) return new NextResponse('not found', { status: 404 });

  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30));
  const data = await buildReport(db, ws.id as string, days);
  return new NextResponse(renderReportHtml(data), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
