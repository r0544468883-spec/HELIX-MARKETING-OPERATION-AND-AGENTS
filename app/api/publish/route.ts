import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendToChannel } from '@/lib/distribution';
import type { SendResult } from '@/lib/distribution/types';
import { workspaceIdByToken, upsertContent, pingRevalidate } from '@/lib/headless/store';
import { publishTo } from '@/lib/publish';

export const dynamic = 'force-dynamic';

// Processes due scheduled publications. Wire to a Vercel Cron; protect with ?secret=DIGEST_SECRET.
export async function GET(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const provided = new URL(req.url).searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const nowISO = new Date().toISOString();
  const { data: due } = await admin
    .from('publications')
    .select('id, channel, content, workspace_id')
    .eq('status', 'pending')
    .lte('scheduled_at', nowISO)
    .limit(50);

  let sent = 0;
  let failed = 0;
  for (const p of due ?? []) {
    const { data: conn } = await admin
      .from('channel_connections')
      .select('config')
      .eq('workspace_id', p.workspace_id as string)
      .eq('channel', p.channel as string)
      .maybeSingle();

    const res: SendResult = conn
      ? await sendToChannel(p.channel as string, conn.config as Record<string, unknown>, p.content as string)
      : { ok: false, error: 'no_connection' };

    await admin
      .from('publications')
      .update({
        status: res.ok ? 'sent' : 'failed',
        external_id: res.externalId ?? null,
        error: res.ok ? null : res.error ?? 'error',
        sent_at: res.ok ? new Date().toISOString() : null,
      })
      .eq('id', p.id as string);

    if (res.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ processed: (due ?? []).length, sent, failed });
}

// Developer API — PUSH. External code posts a content item with the workspace's
// content_api_token (header `x-helix-api-key` or body.token); we store it in the headless
// feed (upsert by external_id), optionally publish to a CMS, and fire an on-demand ISR
// ping to the workspace's configured revalidate webhook so static sites regenerate.
//   POST /api/publish { title, html|content_html, excerpt?, slug?, status?, external_id?, cms?, cms_config? }
export async function POST(req: Request) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    title?: string;
    html?: string;
    content_html?: string;
    excerpt?: string;
    slug?: string;
    status?: 'draft' | 'published';
    external_id?: string;
    cms?: string;
    cms_config?: Record<string, unknown>;
  };

  const token = req.headers.get('x-helix-api-key') || body.token || '';
  const workspaceId = await workspaceIdByToken(admin, token);
  if (!workspaceId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const html = body.html ?? body.content_html;
  if (!body.title || !html) return NextResponse.json({ error: 'title_and_html_required' }, { status: 400 });

  const item = await upsertContent(admin, workspaceId, {
    external_id: body.external_id,
    title: body.title,
    slug: body.slug,
    html,
    excerpt: body.excerpt,
    status: body.status ?? 'published',
  });
  if (!item) return NextResponse.json({ error: 'store_failed' }, { status: 500 });

  let cms: { ok: boolean; url?: string; error?: string } | undefined;
  if (body.cms && body.cms_config) {
    const r = await publishTo(body.cms, body.cms_config, {
      title: item.title,
      content_html: item.html,
      excerpt: item.excerpt ?? undefined,
      status: item.status === 'published' ? 'publish' : 'draft',
    });
    cms = { ok: r.ok, url: r.url, error: r.error };
  }

  const revalidated = item.status === 'published' ? await pingRevalidate(admin, workspaceId, item) : false;
  return NextResponse.json({ ok: true, id: item.id, slug: item.slug, revalidated, cms });
}
