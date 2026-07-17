import type { ChannelConfig, SendResult } from './types';

// Telegram Bot API — config: { bot_token, chat_id }
export async function sendTelegram(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.bot_token as string | undefined;
  const chatId = config.chat_id as string | undefined;
  if (!token || !chatId) return { ok: false, error: 'telegram_not_configured' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: content }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
    };
    if (!res.ok || !json.ok) return { ok: false, error: `telegram_${res.status}` };
    return { ok: true, externalId: String(json.result?.message_id ?? '') };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
