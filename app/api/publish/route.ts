import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendToChannel } from '@/lib/distribution';
import type { SendResult } from '@/lib/distribution/types';

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
