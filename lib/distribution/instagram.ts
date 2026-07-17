import type { ChannelConfig, SendResult } from './types';

// Instagram — config: { ig_user_id, access_token, image_url }.
// IG requires media — text is the caption. Two-step: create container → publish.
export async function sendInstagram(config: ChannelConfig, content: string): Promise<SendResult> {
  const igId = config.ig_user_id as string | undefined;
  const token = config.access_token as string | undefined;
  const imageUrl = config.image_url as string | undefined;
  if (!igId || !token) return { ok: false, error: 'instagram_not_configured' };
  if (!imageUrl) return { ok: false, error: 'instagram_requires_image' };

  try {
    const createRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption: content, access_token: token }),
    });
    const createJson = (await createRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !createJson.id) {
      return { ok: false, error: createJson.error?.message ?? `instagram_${createRes.status}` };
    }

    const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creation_id: createJson.id, access_token: token }),
    });
    const pubJson = (await pubRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!pubRes.ok) return { ok: false, error: pubJson.error?.message ?? `instagram_${pubRes.status}` };
    return { ok: true, externalId: pubJson.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
