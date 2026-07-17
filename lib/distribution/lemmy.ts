import type { ChannelConfig, SendResult } from './types';

// Lemmy — config: { instance_url, jwt, community_id, title? }. Creates a post.
export async function sendLemmy(config: ChannelConfig, content: string): Promise<SendResult> {
  const instance = (config.instance_url as string | undefined)?.replace(/\/+$/, '');
  const jwt = config.jwt as string | undefined;
  const communityId = config.community_id as string | undefined;
  if (!instance || !jwt || !communityId) return { ok: false, error: 'lemmy_not_configured' };
  const name = (config.title as string | undefined) || content.split('\n')[0].slice(0, 200) || 'Post';
  try {
    const res = await fetch(`${instance}/api/v3/post`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name, body: content, community_id: Number(communityId) }),
    });
    const json = (await res.json().catch(() => ({}))) as { post_view?: { post?: { id?: number } }; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `lemmy_${res.status}` };
    const id = json.post_view?.post?.id;
    return { ok: true, externalId: id != null ? String(id) : undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
