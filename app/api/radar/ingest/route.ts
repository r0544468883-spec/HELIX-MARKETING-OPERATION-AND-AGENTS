import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { matchedKeywords, scoreIntent } from '@/lib/radar/intent';
import { sendToChannel } from '@/lib/distribution';

export const dynamic = 'force-dynamic';

// Ingest a discovered post from the Lead Radar sources.
// Called by the browser extension (Facebook groups — no API) or an API poller.
// Auth: shared EXTENSION_SECRET header + workspace id in the body.
// Flow: keyword match -> intent score -> (if above threshold) lead + alert.
type IngestBody = {
  workspace?: string;
  source?: string; // 'fb_group' | 'reddit' | ...
  source_ref?: string;
  post_url?: string;
  author?: string;
  content?: string;
};

type RadarConfig = {
  id: string;
  keywords: string[];
  icp: string | null;
  min_intent: number;
  alert_channels: string[];
  sources: { type?: string; id?: string }[];
};

export async function POST(req: Request) {
  if (req.headers.get('x-ext-secret') !== process.env.EXTENSION_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as IngestBody;
  if (!body.workspace || !body.content) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data: radars } = await admin
    .from('radar_configs')
    .select('id, keywords, icp, min_intent, alert_channels, sources')
    .eq('workspace_id', body.workspace)
    .eq('active', true);

  const created: string[] = [];

  for (const r of (radars ?? []) as RadarConfig[]) {
    const matched = matchedKeywords(body.content, r.keywords);
    if (matched.length === 0) continue; // radar not interested in this post

    const intent = await scoreIntent(body.content, r.icp ?? '');
    if (intent < Number(r.min_intent)) continue; // not a strong enough buying signal

    const { data: lead } = await admin
      .from('radar_leads')
      .insert({
        workspace_id: body.workspace,
        radar_id: r.id,
        source: body.source ?? 'unknown',
        source_ref: body.source_ref ?? null,
        post_url: body.post_url ?? null,
        author: body.author ?? null,
        content: body.content,
        intent_score: intent,
        matched,
        alerted: false,
      })
      .select('id')
      .single();

    // Real-time alert to the chosen channels.
    const alerted = await dispatchAlerts(admin, body, r);
    if (lead?.id) {
      if (alerted) await admin.from('radar_leads').update({ alerted: true }).eq('id', lead.id);
      created.push(lead.id as string);
    }
  }

  return NextResponse.json({ leads: created.length });
}

async function dispatchAlerts(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  body: IngestBody,
  radar: RadarConfig
): Promise<boolean> {
  if (radar.alert_channels.length === 0) return false;
  const snippet = (body.content ?? '').slice(0, 180);
  const text = `🎯 ליד חדש (${body.source ?? ''}):\n"${snippet}"\n${body.post_url ?? ''}`;

  let anyOk = false;
  for (const channel of radar.alert_channels) {
    const { data: conn } = await admin
      .from('channel_connections')
      .select('config')
      .eq('workspace_id', body.workspace as string)
      .eq('channel', channel)
      .maybeSingle();
    if (!conn) continue;
    const res = await sendToChannel(channel, conn.config as Record<string, unknown>, text);
    if (res.ok) anyOk = true;
  }
  return anyOk;
}
