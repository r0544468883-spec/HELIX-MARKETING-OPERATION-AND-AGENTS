import type { ChannelConfig, SendResult } from './types';

// Mastodon — config: { instance_url, access_token }
export async function sendMastodon(config: ChannelConfig, content: string): Promise<SendResult> {
  const instance = (config.instance_url as string | undefined)?.replace(/\/+$/, '');
  const token = config.access_token as string | undefined;
  if (!instance || !token) return { ok: false, error: 'mastodon_not_configured' };
  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: content }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `mastodon_${res.status}` };
    return { ok: true, externalId: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
