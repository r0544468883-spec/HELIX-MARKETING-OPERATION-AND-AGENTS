import type { ChannelConfig, SendResult } from './types';

// X (Twitter) — config: { bearer_token } (OAuth 2.0 user-context token). API v2 is paid.
export async function sendX(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.bearer_token as string | undefined;
  if (!token) return { ok: false, error: 'x_not_configured' };
  try {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: content }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { id?: string };
      detail?: string;
    };
    if (!res.ok) return { ok: false, error: json.detail ?? `x_${res.status}` };
    return { ok: true, externalId: json.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
