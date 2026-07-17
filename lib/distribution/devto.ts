import type { ChannelConfig, SendResult } from './types';

// Dev.to (Forem) — config: { api_key, title? }. Publishes a markdown article.
export async function sendDevto(config: ChannelConfig, content: string): Promise<SendResult> {
  const apiKey = config.api_key as string | undefined;
  if (!apiKey) return { ok: false, error: 'devto_not_configured' };
  const title = (config.title as string | undefined) || content.split('\n')[0].slice(0, 120) || 'Post';
  try {
    const res = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ article: { title, body_markdown: content, published: true } }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `devto_${res.status}` };
    return { ok: true, externalId: json.id != null ? String(json.id) : undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
