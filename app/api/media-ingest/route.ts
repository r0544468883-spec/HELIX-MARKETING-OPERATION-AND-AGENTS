import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateCaption, type ClientProfile } from '@/lib/content/caption';
import { bestHour } from '@/lib/agentos/learning';

export const dynamic = 'force-dynamic';

// Media Auto-Ingest: the "drop a file → agent captions + schedules" routine.
// Scans new media assets, writes a per-network caption (client-profile aware,
// Hebrew via the shared writing skill), and queues publications. Learning loop
// picks the posting hour when the asset has no explicit scheduled_at.
// Wire to a Vercel Cron; protect with ?secret=DIGEST_SECRET.
export async function GET(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const provided = new URL(req.url).searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data: assets } = await admin
    .from('media_assets')
    .select('id, workspace_id, client_id, title, description, topic, storage_path, target_networks, scheduled_at')
    .eq('status', 'new')
    .order('priority', { ascending: true })
    .limit(20);

  let scheduled = 0;

  for (const a of assets ?? []) {
    const workspaceId = a.workspace_id as string;
    const networks = (a.target_networks as string[] | undefined) ?? [];
    if (networks.length === 0) continue;

    // Load the client profile (content context).
    let profile: ClientProfile | null = null;
    if (a.client_id) {
      const { data: p } = await admin
        .from('client_profiles')
        .select('name, audience, voice, dos_donts, lang')
        .eq('id', a.client_id as string)
        .maybeSingle();
      profile = (p as ClientProfile) ?? null;
    }

    for (const network of networks) {
      let caption = '';
      try {
        caption = await generateCaption(
          { title: a.title as string | null, description: a.description as string | null, topic: a.topic as string | null },
          network,
          profile
        );
      } catch {
        continue; // skip this network on failure, keep others
      }

      // Explicit time, or the learning loop's best hour for this network.
      const when = (a.scheduled_at as string | null) ?? (await bestHour(admin, workspaceId, network));

      await admin.from('publications').insert({
        workspace_id: workspaceId,
        channel: network,
        content: caption,
        scheduled_at: when,
        status: 'pending',
      });
    }

    await admin.from('media_assets').update({ status: 'scheduled' }).eq('id', a.id as string);
    scheduled++;
  }

  return NextResponse.json({ assets_scheduled: scheduled });
}
