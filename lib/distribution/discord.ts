import type { ChannelConfig, SendResult } from './types';

// Discord — config: { webhook_url }
export async function sendDiscord(config: ChannelConfig, content: string): Promise<SendResult> {
  const webhook = config.webhook_url as string | undefined;
  if (!webhook) return { ok: false, error: 'discord_not_configured' };
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return { ok: false, error: `discord_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
