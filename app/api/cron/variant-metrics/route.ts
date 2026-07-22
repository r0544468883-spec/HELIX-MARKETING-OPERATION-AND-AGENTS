import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchInsights } from '@/lib/insights';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Scheduled per-variant metrics sync — pulls impressions/views/clicks from each
// platform for every published variant and stores them on content_variants.
// Powers real A/B ("how many watched/clicked this variant") + auto-winner.
const CH_LABEL: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם', linkedin: 'לינקדאין', tiktok: 'TikTok', youtube: 'YouTube' };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = new URL(req.url).searchParams.get('secret') || req.headers.get('x-cron-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin' }, { status: 500 });

  const { data: variants } = await admin.from('content_variants')
    .select('id, workspace_id, channel, external_id').eq('published', true).not('external_id', 'is', null).limit(500);

  const configCache = new Map<string, Record<string, unknown>>();
  let updated = 0;
  for (const v of variants ?? []) {
    const label = CH_LABEL[v.channel as string] ?? (v.channel as string);
    const key = `${v.workspace_id}:${label}`;
    let config = configCache.get(key);
    if (!config) {
      const { data: conn } = await admin.from('channel_connections').select('config').eq('workspace_id', v.workspace_id).eq('channel', label).maybeSingle();
      config = (conn?.config ?? {}) as Record<string, unknown>;
      configCache.set(key, config);
    }
    const m = await fetchInsights(label, config, v.external_id as string);
    if (!m) continue;
    await admin.from('content_variants').update({
      impressions: m.impressions ?? 0, views: m.views ?? 0, clicks: m.clicks ?? 0, ...(m.conversions != null ? { conversions: m.conversions } : {}),
    }).eq('id', v.id);
    updated++;
  }
  return NextResponse.json({ ok: true, checked: (variants ?? []).length, updated });
}
