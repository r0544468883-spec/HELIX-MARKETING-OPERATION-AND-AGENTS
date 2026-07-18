import type { ChannelConfig, SendResult } from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';

// Public reply to a comment on a Facebook/Instagram post.
// config: { access_token }. Creates a reply under the given comment.
export async function replyToComment(
  config: ChannelConfig,
  commentId: string,
  message: string
): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  if (!token) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${commentId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, access_token: token }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `reply_${res.status}` };
    return { ok: true, externalId: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Private Reply (Meta): DM a user in response to their comment — the compliant
// Comment-to-DM mechanism. config: { page_id, access_token }. Works for FB Pages
// and IG professional accounts; allowed once per comment, within 7 days.
export async function sendPrivateReply(
  config: ChannelConfig,
  commentId: string,
  message: string
): Promise<SendResult> {
  const pageId = config.page_id as string | undefined;
  const token = config.access_token as string | undefined;
  if (!pageId || !token) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${pageId}/messages?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: message } }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `private_reply_${res.status}` };
    return { ok: true, externalId: json.message_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Standard Page/IG message to a user (by PSID) inside an open 24h window.
// config: { page_id, access_token }. Use for auto-reply to inbound DMs.
export async function sendPageMessage(
  config: ChannelConfig,
  psid: string,
  message: string
): Promise<SendResult> {
  const pageId = config.page_id as string | undefined;
  const token = config.access_token as string | undefined;
  if (!pageId || !token) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${pageId}/messages?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, message: { text: message } }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `page_message_${res.status}` };
    return { ok: true, externalId: json.message_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Telegram DM to a specific chat. config: { bot_token }.
export async function sendTelegramDm(
  config: ChannelConfig,
  chatId: string,
  message: string
): Promise<SendResult> {
  const token = config.bot_token as string | undefined;
  if (!token) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number } };
    if (!res.ok || !json.ok) return { ok: false, error: `telegram_${res.status}` };
    return { ok: true, externalId: String(json.result?.message_id ?? '') };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// WhatsApp DM to a specific recipient inside an open 24h window.
// config: { access_token, phone_number_id }.
export async function sendWhatsAppDm(
  config: ChannelConfig,
  to: string,
  message: string
): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const phoneId = config.phone_number_id as string | undefined;
  if (!token || !phoneId) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `whatsapp_${res.status}` };
    return { ok: true, externalId: json.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
