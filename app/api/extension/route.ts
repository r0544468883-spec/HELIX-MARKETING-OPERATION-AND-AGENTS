import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureLimit, canAct, recordAction } from '@/lib/engagement/rate-limiter';

export const dynamic = 'force-dynamic';

// Bridge for the browser extension (gray path: LinkedIn / IG+FB feed — no API).
// The extension performs the action in the user's own browser; the server only
// queues approved actions (under the safety caps + explicit consent) and records
// the outcome. Auth: shared EXTENSION_SECRET header + workspace id.
const GRAY_CHANNELS = ['לינקדאין', 'אינסטגרם', 'פייסבוק'];

function authed(req: Request): boolean {
  const secret = process.env.EXTENSION_SECRET;
  return !!secret && req.headers.get('x-ext-secret') === secret;
}

// GET — the extension pulls the next approved gray actions it's allowed to run now.
export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const workspaceId = new URL(req.url).searchParams.get('workspace');
  if (!workspaceId) return NextResponse.json({ error: 'no_workspace' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  // Only channels the workspace explicitly consented to (risk acceptance).
  const { data: consents } = await admin
    .from('risk_consents')
    .select('channel')
    .eq('workspace_id', workspaceId);
  const consented = new Set((consents ?? []).map((c) => c.channel as string));
  const allowed = GRAY_CHANNELS.filter((c) => consented.has(c));
  if (allowed.length === 0) return NextResponse.json({ actions: [] });

  const { data: actions } = await admin
    .from('engagement_actions')
    .select('id, channel, target_id, content')
    .eq('workspace_id', workspaceId)
    .eq('status', 'approved')
    .in('channel', allowed)
    .order('created_at', { ascending: true })
    .limit(10);

  const out: { id: string; channel: string; target_url: string | null; content: string }[] = [];
  for (const a of actions ?? []) {
    const channel = a.channel as string;
    const limit = await ensureLimit(admin, workspaceId, channel);
    if (!canAct(limit).ok) continue; // caps / gap / kill-switch

    let targetUrl: string | null = null;
    if (a.target_id) {
      const { data: t } = await admin
        .from('engagement_targets')
        .select('post_url')
        .eq('id', a.target_id as string)
        .maybeSingle();
      targetUrl = (t?.post_url as string | undefined) ?? null;
    }
    out.push({ id: a.id as string, channel, target_url: targetUrl, content: (a.content as string) ?? '' });
  }

  return NextResponse.json({ actions: out });
}

// POST — the extension reports the outcome of an action it performed.
export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    workspace?: string;
    ok?: boolean;
    external_id?: string;
    error?: string;
  };
  if (!body.id || !body.workspace) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const { data: action } = await admin
    .from('engagement_actions')
    .select('channel')
    .eq('id', body.id)
    .maybeSingle();

  await admin
    .from('engagement_actions')
    .update({
      status: body.ok ? 'posted' : 'failed',
      external_id: body.external_id ?? null,
      error: body.ok ? null : body.error ?? 'extension_error',
      posted_at: body.ok ? new Date().toISOString() : null,
    })
    .eq('id', body.id);

  if (body.ok && action?.channel) {
    const limit = await ensureLimit(admin, body.workspace, action.channel as string);
    await recordAction(admin, limit);
  }

  return NextResponse.json({ ok: true });
}
