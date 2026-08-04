import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { matchFunnel, renderTemplate } from '@/lib/funnels/matcher';
import { replyToComment, sendPrivateReply, sendPageMessage } from '@/lib/distribution/reply';
import { generateDmReply, classifyIntent } from '@/lib/engagement/engage-agent';
import { handleBotMessage } from '@/lib/bot/router';
import { sendWhatsApp } from '@/lib/distribution/whatsapp';
import type { CommentFunnel } from '@/lib/engagement/types';

export const dynamic = 'force-dynamic';

// 1) Webhook verification (Meta calls GET once with a challenge).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

type CommentValue = {
  item?: string;
  verb?: string;
  comment_id?: string;
  post_id?: string;
  message?: string;
  from?: { id?: string; name?: string };
};

type MessagingEvent = {
  sender?: { id?: string };
  message?: { text?: string };
};

// WhatsApp Cloud inbound (delivered on the same Meta app webhook, field = 'messages').
type WhatsAppValue = {
  messaging_product?: string;
  metadata?: { phone_number_id?: string };
  messages?: { from?: string; type?: string; text?: { body?: string } }[];
};

// Look up which workspace owns a given Meta page (via channel_connections.config.page_id).
async function findConnection(admin: ReturnType<typeof createAdminClient>, pageId: string) {
  if (!admin) return null;
  const { data } = await admin
    .from('channel_connections')
    .select('workspace_id, channel, config')
    .eq('config->>page_id', pageId)
    .limit(1)
    .maybeSingle();
  return data as { workspace_id: string; channel: string; config: Record<string, unknown> } | null;
}

// Look up the workspace that owns a given WhatsApp phone number (via config.phone_number_id).
async function findWhatsAppConnection(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  phoneNumberId: string
) {
  const { data } = await admin
    .from('channel_connections')
    .select('workspace_id, config')
    .eq('config->>phone_number_id', phoneNumberId)
    .limit(1)
    .maybeSingle();
  return data as { workspace_id: string; config: Record<string, unknown> } | null;
}

// 2) Event delivery. Always return 200 fast; process best-effort.
export async function POST(req: Request) {
  const admin = createAdminClient();
  let body: {
    entry?: {
      id?: string;
      changes?: { field?: string; value?: CommentValue & WhatsAppValue }[];
      messaging?: MessagingEvent[];
    }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!admin) return NextResponse.json({ ok: true });

  for (const entry of body.entry ?? []) {
    const pageId = entry.id ?? '';

    // --- Comment-to-DM funnels + WhatsApp operator-bot inbound ---
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v) continue;
      // WhatsApp user message → operator bot (kept separate from FB/IG engagement).
      if (change.field === 'messages' && v.messaging_product === 'whatsapp' && v.messages?.length) {
        await handleWhatsAppBot(admin, v);
        continue;
      }
      if (v.item !== 'comment' || v.verb !== 'add') continue;
      if (!v.comment_id || !v.post_id) continue;
      await handleComment(admin, pageId, v);
    }

    // --- Auto-reply to inbound DMs ---
    for (const m of entry.messaging ?? []) {
      const text = m.message?.text;
      const senderId = m.sender?.id;
      if (!text || !senderId) continue;
      await handleMessage(admin, pageId, senderId, text);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleComment(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  pageId: string,
  v: CommentValue
) {
  const conn = await findConnection(admin, pageId);
  if (!conn) return;

  const { data: funnelRows } = await admin
    .from('comment_funnels')
    .select('*')
    .eq('workspace_id', conn.workspace_id)
    .eq('active', true);

  const funnel = matchFunnel((funnelRows ?? []) as CommentFunnel[], v.post_id ?? '', v.message ?? '');
  if (!funnel) return;

  const vars = { שם: v.from?.name ?? '', name: v.from?.name ?? '' };

  // Public reply under the comment.
  const pub = await replyToComment(conn.config, v.comment_id ?? '', funnel.public_reply_text);
  // Private reply (DM) with the rendered wording.
  const dm = await sendPrivateReply(conn.config, v.comment_id ?? '', renderTemplate(funnel.dm_message, vars));

  await admin.from('funnel_leads').insert({
    funnel_id: funnel.id,
    workspace_id: conn.workspace_id,
    commenter: v.from?.name ?? v.from?.id ?? null,
    comment_text: v.message ?? null,
    public_replied: pub.ok,
    dm_sent: dm.ok,
    dm_status: dm.ok ? 'sent' : 'failed',
  });
}

async function handleMessage(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  pageId: string,
  senderId: string,
  text: string
) {
  const conn = await findConnection(admin, pageId);
  if (!conn) return;

  const intent = await classifyIntent(text).catch(() => 'other' as const);

  await admin.from('dm_threads').upsert(
    {
      workspace_id: conn.workspace_id,
      channel: conn.channel,
      contact: senderId,
      last_msg: text,
      intent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,channel,contact' }
  );

  // Only auto-reply if the thread is opted in; spam is never auto-answered.
  const { data: thread } = await admin
    .from('dm_threads')
    .select('auto_reply_enabled')
    .eq('workspace_id', conn.workspace_id)
    .eq('channel', conn.channel)
    .eq('contact', senderId)
    .maybeSingle();

  if (intent === 'spam' || !thread?.auto_reply_enabled) return;

  const reply = await generateDmReply(text, 'ענה בקצרה ובאדיבות בשם העסק.').catch(() => '');
  if (!reply) return;
  await sendPageMessage(conn.config, senderId, reply);
}

// Inbound WhatsApp user message → HELIX OPS operator bot. Resolves the workspace
// from bot_links (inside handleBotMessage) so the answer uses THAT workspace's data,
// then replies on the same WhatsApp number. `from` is the bare-digit wa_id.
async function handleWhatsAppBot(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  v: WhatsAppValue
) {
  const msg = v.messages?.[0];
  const from = msg?.from;
  const text = msg?.type === 'text' ? msg.text?.body : undefined;
  const phoneNumberId = v.metadata?.phone_number_id;
  if (!from || !text || !phoneNumberId) return;

  // Need the workspace's WhatsApp credentials to reply (access_token + phone_number_id).
  const conn = await findWhatsAppConnection(admin, phoneNumberId);
  if (!conn) return;

  const reply = await handleBotMessage({ channel: 'whatsapp', identifier: from, text });
  await sendWhatsApp({ ...conn.config, recipients: [from] }, reply);
}
