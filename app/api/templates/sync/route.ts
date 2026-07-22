// POST /api/templates/sync?secret=... — registers every WhatsApp template in the
// catalog on the workspace's WABA (Meta message_templates). Idempotent: templates
// that already exist are treated as OK. Run once after setting up the WABA, and
// again whenever the catalog changes. Templates then need Meta APPROVAL (async).
// Body (optional): { workspace } — the OPS workspace whose WhatsApp connection holds
// the WABA id (channel_connections.config.waba_id for the 'וואטסאפ' channel).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createWhatsAppTemplate } from '@/lib/distribution/whatsapp';
import { allRegistrationPayloads } from '@/lib/templates/whatsapp-catalog';
import type { ChannelConfig } from '@/lib/distribution/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.EXPORT_SECRET;
  const provided = url.searchParams.get('secret') || req.headers.get('x-export-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { workspace?: string };
  const workspaceId = body.workspace || url.searchParams.get('workspace');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_required' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin' }, { status: 500 });

  const { data: conn } = await admin
    .from('channel_connections')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('channel', 'וואטסאפ')
    .maybeSingle();
  const config = (conn?.config ?? {}) as ChannelConfig & { waba_id?: string };
  const wabaId = config.waba_id as string | undefined;
  if (!wabaId) return NextResponse.json({ error: 'waba_id missing in channel_connections config (add it to register templates)' }, { status: 400 });

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  const results: { name: unknown; ok: boolean; status?: string; error?: string }[] = [];
  for (const payload of allRegistrationPayloads(appUrl)) {
    const r = await createWhatsAppTemplate(config, wabaId, payload);
    results.push({ name: payload.name, ok: r.ok, status: r.status, error: r.error });
  }
  return NextResponse.json({ ok: true, registered: results.filter((r) => r.ok).length, total: results.length, results });
}
