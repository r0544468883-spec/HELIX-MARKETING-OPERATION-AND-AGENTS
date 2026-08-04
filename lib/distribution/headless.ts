import type { ChannelConfig, SendResult } from './types';
import { publishTo } from '../publish';

// Headless / custom-site channel — pushes content to any CMS the customer runs
// (WordPress / Wix / Webflow) or a generic webhook for React/Next/Astro/Vue sites.
// config: { cms?: 'webhook'|'wordpress'|'wix'|'webflow', title?, excerpt?, status?, ...adapterCreds }.
// Content arrives as a plain string; we derive a title from config.title or the first line.
export async function sendHeadless(config: ChannelConfig, content: string): Promise<SendResult> {
  const cms = (config.cms as string) || 'webhook';
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const title = (config.title as string) || lines[0] || 'Untitled';
  const status = (config.status as 'draft' | 'publish') ?? 'draft';

  const res = await publishTo(cms, config as Record<string, unknown>, {
    title,
    content_html: content,
    excerpt: config.excerpt as string | undefined,
    status,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, externalId: res.url ?? (res.id != null ? String(res.id) : undefined) };
}
