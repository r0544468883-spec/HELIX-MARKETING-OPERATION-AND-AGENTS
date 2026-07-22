import { NextResponse } from 'next/server';
import { handleBotMessage } from '@/lib/bot/router';
import { sendTelegram } from '@/lib/distribution/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Unified bot webhook. Telegram posts updates here; the same handleBotMessage
// router serves WhatsApp/email inbound too (add their webhooks pointing here).
// Every HELIX OPS function is reachable through this one entry point.
export async function POST(req: Request) {
  const update = (await req.json().catch(() => ({}))) as { message?: { chat?: { id?: number }; text?: string } };
  const chatId = update.message?.chat?.id;
  const text = update.message?.text ?? '';
  if (!chatId || !text) return NextResponse.json({ ok: true });

  const reply = await handleBotMessage({ channel: 'telegram', identifier: String(chatId), text });
  await sendTelegram({ bot_token: process.env.TELEGRAM_BOT_TOKEN, chat_id: String(chatId) }, reply);
  return NextResponse.json({ ok: true });
}
