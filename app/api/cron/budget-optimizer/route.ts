import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { optimizePaidAsset } from '@/lib/budget-optimizer';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Scheduled budget loop (#4) — for every launched paid campaign asset, keep the
// winning ad and pause losers so spend concentrates on what performs. Service-role.
const CH_LABEL: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם' };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = new URL(req.url).searchParams.get('secret') || req.headers.get('x-cron-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin' }, { status: 500 });

  const { data: assets } = await admin.from('campaign_assets').select('workspace_id, channel, paid_campaign').not('paid_campaign', 'is', null).limit(200);

  let paused = 0, kept = 0;
  const cache = new Map<string, Record<string, unknown>>();
  for (const a of assets ?? []) {
    const label = CH_LABEL[a.channel as string];
    if (!label) continue;
    const key = `${a.workspace_id}:${label}`;
    let config = cache.get(key);
    if (!config) {
      const { data: conn } = await admin.from('channel_connections').select('config').eq('workspace_id', a.workspace_id).eq('channel', label).maybeSingle();
      config = (conn?.config ?? {}) as Record<string, unknown>;
      cache.set(key, config);
    }
    const r = await optimizePaidAsset(config, (a.paid_campaign ?? {}) as { adsets?: { name: string; adsetId: string; adIds: string[] }[] });
    paused += r.paused; kept += r.kept;
  }
  return NextResponse.json({ ok: true, assets: (assets ?? []).length, paused, kept });
}
