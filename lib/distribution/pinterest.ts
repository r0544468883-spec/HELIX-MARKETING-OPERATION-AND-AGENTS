import type { ChannelConfig, SendResult } from './types';

// Pinterest — config: { access_token, board_id, image_url }. Creates a Pin (requires an image).
export async function sendPinterest(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const boardId = config.board_id as string | undefined;
  const imageUrl = config.image_url as string | undefined;
  if (!token || !boardId) return { ok: false, error: 'pinterest_not_configured' };
  if (!imageUrl) return { ok: false, error: 'pinterest_requires_image' };
  try {
    const res = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        description: content.slice(0, 800),
        media_source: { source_type: 'image_url', url: imageUrl },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `pinterest_${res.status}` };
    return { ok: true, externalId: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
