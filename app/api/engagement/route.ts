import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureLimit, canAct, recordAction } from '@/lib/engagement/rate-limiter';
import { replyToComment } from '@/lib/distribution/reply';
import { replyToTweet, replyMastodon, replyReddit, replyBluesky, replyNostr } from '@/lib/distribution/feed-reply';
import type { ChannelConfig, SendResult } from '@/lib/distribution/types';

export const dynamic = 'force-dynamic';

// Executes HITL-approved engagement actions, one channel-send at a time,
// strictly under the per-channel safety caps + min-gap. Wire to a Vercel Cron.
// Protect with ?secret=DIGEST_SECRET.
// API-native channels post here; gray channels (LinkedIn / IG+FB feed) have no
// API and are handled by the browser-extension bridge (app/api/extension).
const GRAY_CHANNELS = new Set(['לינקדאין']);

// Dispatch a reply to the right per-network adapter.
async function channelReply(
  channel: string,
  config: ChannelConfig,
  targetId: string,
  content: string
): Promise<SendResult> {
  switch (channel) {
    case 'פייסבוק':
      return replyToComment(config, targetId, content); // comment on a post
    case 'X':
      return replyToTweet(config, targetId, content);
    case 'Reddit':
      return replyReddit(config, targetId, content);
    case 'Mastodon':
      return replyMastodon(config, targetId, content);
    case 'Bluesky':
      return replyBluesky(config, targetId, content);
    case 'Nostr':
      return replyNostr(config, targetId, content);
    default:
      // אינסטגרם/פייסבוק-feed/לינקדאין = אין API לתגובה בפיד → דרך האקסטנשן
      return { ok: false, error: 'channel_reply_not_implemented' };
  }
}

export async function GET(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const provided = new URL(req.url).searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  // Oldest approved actions first.
  const { data: actions } = await admin
    .from('engagement_actions')
    .select('id, workspace_id, channel, target_id, content')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(25);

  let posted = 0;
  let skipped = 0;

  for (const a of actions ?? []) {
    const workspaceId = a.workspace_id as string;
    const channel = a.channel as string;

    // Safety gate: caps, warm-up, min-gap, kill-switch.
    const limit = await ensureLimit(admin, workspaceId, channel);
    const decision = canAct(limit);
    if (!decision.ok) {
      skipped++;
      continue; // stays 'approved' for the next run
    }

    // Resolve the target object (Meta post/comment id lives in post_url for now).
    let objectId: string | null = null;
    if (a.target_id) {
      const { data: t } = await admin
        .from('engagement_targets')
        .select('post_url')
        .eq('id', a.target_id as string)
        .maybeSingle();
      objectId = (t?.post_url as string | undefined) ?? null;
    }

    let ok = false;
    let externalId: string | undefined;
    let error: string | undefined;

    if (GRAY_CHANNELS.has(channel)) {
      // Gray channels are executed by the browser extension, not the server.
      error = 'handled_by_extension';
    } else if (!objectId) {
      error = 'no_target';
    } else {
      const { data: conn } = await admin
        .from('channel_connections')
        .select('config')
        .eq('workspace_id', workspaceId)
        .eq('channel', channel)
        .maybeSingle();
      if (conn) {
        const res = await channelReply(channel, conn.config as ChannelConfig, objectId, (a.content as string) ?? '');
        ok = res.ok;
        externalId = res.externalId;
        error = res.error;
      } else {
        error = 'no_connection';
      }
    }

    await admin
      .from('engagement_actions')
      .update({
        status: ok ? 'posted' : 'failed',
        external_id: externalId ?? null,
        error: ok ? null : error ?? 'error',
        posted_at: ok ? new Date().toISOString() : null,
      })
      .eq('id', a.id as string);

    if (ok) {
      await recordAction(admin, limit);
      posted++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ processed: (actions ?? []).length, posted, skipped });
}
