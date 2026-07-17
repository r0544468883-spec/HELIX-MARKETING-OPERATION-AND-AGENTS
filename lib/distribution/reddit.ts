import type { ChannelConfig, SendResult } from './types';

// Reddit — config: { access_token, subreddit, title? }. Self (text) post.
export async function sendReddit(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const sr = config.subreddit as string | undefined;
  if (!token || !sr) return { ok: false, error: 'reddit_not_configured' };
  const title = (config.title as string | undefined) || content.split('\n')[0].slice(0, 280) || 'Post';
  try {
    const body = new URLSearchParams({ sr, kind: 'self', title, text: content, api_type: 'json' });
    const res = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'HELIX-OPS/1.0',
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { json?: { data?: { id?: string }; errors?: unknown[] } };
    if (!res.ok || (json.json?.errors && json.json.errors.length)) {
      return { ok: false, error: `reddit_${res.status}` };
    }
    return { ok: true, externalId: json.json?.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
