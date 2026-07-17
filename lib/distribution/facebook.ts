import type { ChannelConfig, SendResult } from './types';

// Facebook Page — config: { page_id, access_token }. Posts to the page feed.
export async function sendFacebook(config: ChannelConfig, content: string): Promise<SendResult> {
  const pageId = config.page_id as string | undefined;
  const token = config.access_token as string | undefined;
  if (!pageId || !token) return { ok: false, error: 'facebook_not_configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: content, access_token: token }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `facebook_${res.status}` };
    return { ok: true, externalId: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
