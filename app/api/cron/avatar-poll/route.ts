import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveAvatarKey, pollAvatar, type AvatarProvider } from '@/lib/avatar';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Poll pending avatar jobs; when a render is done, write the MP4 URL onto the
// variant (content_variants.video_url) so it's ready to publish as a video.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = new URL(req.url).searchParams.get('secret') || req.headers.get('x-cron-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin' }, { status: 500 });

  const { data: jobs } = await admin.from('avatar_jobs').select('id, workspace_id, variant_id, landing_id, provider, external_id').eq('status', 'processing').limit(50);

  const cache = new Map<string, Record<string, string>>();
  let done = 0;
  for (const j of jobs ?? []) {
    if (!j.external_id) continue;
    let config = cache.get(j.workspace_id as string);
    if (!config) {
      const { data: conn } = await admin.from('channel_connections').select('config').eq('workspace_id', j.workspace_id).eq('channel', 'avatar').maybeSingle();
      config = (conn?.config ?? {}) as Record<string, string>;
      cache.set(j.workspace_id as string, config);
    }
    const { key } = resolveAvatarKey(config, j.provider as AvatarProvider);
    if (!key) continue;
    const r = await pollAvatar(j.provider as AvatarProvider, key, j.external_id as string);
    if (r.status === 'processing') continue;

    await admin.from('avatar_jobs').update({ status: r.status, video_url: r.videoUrl ?? null, updated_at: new Date().toISOString() }).eq('id', j.id);
    if (r.status === 'done' && r.videoUrl) {
      if (j.variant_id) await admin.from('content_variants').update({ video_url: r.videoUrl }).eq('id', j.variant_id);
      if (j.landing_id) { /* landing video block updates handled in the editor */ }
      done++;
    }
  }
  return NextResponse.json({ ok: true, checked: (jobs ?? []).length, done });
}
