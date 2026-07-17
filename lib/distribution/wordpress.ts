import type { ChannelConfig, SendResult } from './types';

// WordPress — config: { site_url, username, app_password, title? }. REST API + Basic auth (Application Password).
export async function sendWordPress(config: ChannelConfig, content: string): Promise<SendResult> {
  const site = (config.site_url as string | undefined)?.replace(/\/+$/, '');
  const username = config.username as string | undefined;
  const appPassword = config.app_password as string | undefined;
  if (!site || !username || !appPassword) return { ok: false, error: 'wordpress_not_configured' };
  const title = (config.title as string | undefined) || content.split('\n')[0].slice(0, 120) || 'Post';
  try {
    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
    const res = await fetch(`${site}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title, content, status: 'publish' }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: number; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `wordpress_${res.status}` };
    return { ok: true, externalId: json.id != null ? String(json.id) : undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
