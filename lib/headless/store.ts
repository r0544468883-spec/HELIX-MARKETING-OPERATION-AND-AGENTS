import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Headless content store — the data layer behind the OPS Developer API. Published
// content items live in `headless_content`; a customer's headless site PULLS them as
// typed JSON from GET /api/content (token auth), and on every publish we PUSH an
// on-demand ISR revalidation ping to the site's configured webhook. This is the
// NexoFlow-parity piece: content produced in OPS flows into React/Next/Astro/etc sites.

type DB = SupabaseClient;

export type HeadlessItem = {
  id: string;
  external_id: string | null;
  title: string;
  slug: string;
  html: string;
  excerpt: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  updated_at: string;
};

export function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}

/** Resolve a workspace id from a Developer-API token (service-role client). */
export async function workspaceIdByToken(admin: DB, token: string): Promise<string | null> {
  if (!token) return null;
  const { data } = await admin.from('workspaces').select('id').eq('content_api_token', token).maybeSingle();
  return (data?.id as string) ?? null;
}

/** The published (or all) content feed for a workspace — typed, ISR-friendly. */
export async function listContent(
  db: DB,
  workspaceId: string,
  opts: { since?: string; status?: 'published' | 'draft' | 'all'; limit?: number } = {}
): Promise<HeadlessItem[]> {
  let q = db
    .from('headless_content')
    .select('id, external_id, title, slug, html, excerpt, status, published_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(200, opts.limit ?? 100));
  if (opts.status && opts.status !== 'all') q = q.eq('status', opts.status);
  else if (!opts.status) q = q.eq('status', 'published');
  if (opts.since) q = q.gt('updated_at', opts.since);
  const { data } = await q;
  return (data ?? []) as HeadlessItem[];
}

export type UpsertInput = {
  external_id?: string;
  title: string;
  slug?: string;
  html: string;
  excerpt?: string;
  status?: 'draft' | 'published';
};

/**
 * Insert or update a content item. Dedupe key is (workspace_id, external_id) when an
 * external_id is given (so a re-publish updates in place); otherwise a new row.
 */
export async function upsertContent(db: DB, workspaceId: string, item: UpsertInput): Promise<HeadlessItem | null> {
  const status = item.status ?? 'published';
  const row = {
    workspace_id: workspaceId,
    external_id: item.external_id ?? null,
    title: item.title,
    slug: item.slug?.trim() || slugify(item.title),
    html: item.html,
    excerpt: item.excerpt ?? null,
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  // Update in place when external_id matches an existing row for this workspace.
  if (item.external_id) {
    const { data: existing } = await db
      .from('headless_content')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('external_id', item.external_id)
      .maybeSingle();
    if (existing?.id) {
      const { data } = await db.from('headless_content').update(row).eq('id', existing.id).select('id, external_id, title, slug, html, excerpt, status, published_at, updated_at').maybeSingle();
      return (data as HeadlessItem) ?? null;
    }
  }
  const { data } = await db.from('headless_content').insert(row).select('id, external_id, title, slug, html, excerpt, status, published_at, updated_at').maybeSingle();
  return (data as HeadlessItem) ?? null;
}

/**
 * On-demand ISR ping — POST to the customer's configured revalidate webhook so their
 * static site regenerates the affected paths. Config lives on the 'Headless' channel
 * connection: { revalidate_url, revalidate_secret? }. Best-effort; never throws.
 */
export async function pingRevalidate(db: DB, workspaceId: string, item: HeadlessItem): Promise<boolean> {
  try {
    const { data: cc } = await db.from('channel_connections').select('config').eq('workspace_id', workspaceId).eq('channel', 'Headless').maybeSingle();
    const config = (cc?.config as { revalidate_url?: string; revalidate_secret?: string } | null) ?? null;
    if (!config?.revalidate_url) return false;
    const res = await fetch(config.revalidate_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.revalidate_secret ? { 'x-helix-secret': config.revalidate_secret } : {}) },
      body: JSON.stringify({ event: 'publish', id: item.id, slug: item.slug, status: item.status, paths: [`/blog/${item.slug}`], tags: ['helix-content'] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
