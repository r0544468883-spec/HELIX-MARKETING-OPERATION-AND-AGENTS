import type { ChannelConfig, SendResult } from './types';

// Google Business Profile — config: { access_token, account_id, location_id }. Creates a local post.
export async function sendGmb(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const accountId = config.account_id as string | undefined;
  const locationId = config.location_id as string | undefined;
  if (!token || !accountId || !locationId) return { ok: false, error: 'gmb_not_configured' };
  try {
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ languageCode: 'he', summary: content.slice(0, 1500), topicType: 'STANDARD' }),
      }
    );
    const json = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `gmb_${res.status}` };
    return { ok: true, externalId: json.name };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
