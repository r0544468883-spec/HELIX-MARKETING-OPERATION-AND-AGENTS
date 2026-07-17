import type { ChannelConfig, SendResult } from './types';

// Slack — config: { webhook_url } (Incoming Webhook)
export async function sendSlack(config: ChannelConfig, content: string): Promise<SendResult> {
  const webhook = config.webhook_url as string | undefined;
  if (!webhook) return { ok: false, error: 'slack_not_configured' };
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: content }),
    });
    if (!res.ok) return { ok: false, error: `slack_${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
