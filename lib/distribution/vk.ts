import type { ChannelConfig, SendResult } from './types';

// VK — config: { access_token, owner_id }. Posts to a wall (owner_id negative for a community).
export async function sendVk(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const ownerId = config.owner_id as string | undefined;
  if (!token || !ownerId) return { ok: false, error: 'vk_not_configured' };
  try {
    const params = new URLSearchParams({
      owner_id: ownerId,
      message: content,
      from_group: '1',
      access_token: token,
      v: '5.199',
    });
    const res = await fetch(`https://api.vk.com/method/wall.post?${params}`, { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as {
      response?: { post_id?: number };
      error?: { error_msg?: string };
    };
    if (json.error) return { ok: false, error: json.error.error_msg ?? 'vk_error' };
    return { ok: true, externalId: json.response?.post_id != null ? String(json.response.post_id) : undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
