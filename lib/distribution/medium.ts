import type { ChannelConfig, SendResult } from './types';

// Medium — config: { integration_token, author_id, title? }. Publishes a markdown post.
export async function sendMedium(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.integration_token as string | undefined;
  const authorId = config.author_id as string | undefined;
  if (!token || !authorId) return { ok: false, error: 'medium_not_configured' };
  const title = (config.title as string | undefined) || content.split('\n')[0].slice(0, 100) || 'Post';
  try {
    const res = await fetch(`https://api.medium.com/v1/users/${authorId}/posts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title, contentFormat: 'markdown', content, publishStatus: 'public' }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }; errors?: { message?: string }[] };
    if (!res.ok) return { ok: false, error: json.errors?.[0]?.message ?? `medium_${res.status}` };
    return { ok: true, externalId: json.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
