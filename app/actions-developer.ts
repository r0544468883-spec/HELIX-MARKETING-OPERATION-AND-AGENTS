'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { upsertContent, pingRevalidate } from '@/lib/headless/store';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', userId).limit(1).maybeSingle();
  return (mem?.workspace_id as string) ?? null;
}

async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' as const };
  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' as const };
  return { supabase, ws };
}

function revalidate() {
  for (const p of ['/he/developer', '/en/developer']) revalidatePath(p);
}

/** Create (once) the Developer-API token for this workspace and return it + the pull URL. */
export async function ensureContentApiToken() {
  const a = await auth();
  if ('error' in a) return a;
  const { data: ws } = await a.supabase.from('workspaces').select('content_api_token').eq('id', a.ws).maybeSingle();
  let token = ws?.content_api_token as string | null;
  if (!token) {
    token = 'hlx_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const { error } = await a.supabase.from('workspaces').update({ content_api_token: token }).eq('id', a.ws);
    if (error) return { error: error.message };
  }
  return { ok: true, token };
}

/** Save the headless channel config: CMS creds and/or the on-demand ISR revalidate webhook. */
export type HeadlessConfigForm = {
  cms?: 'webhook' | 'wordpress' | 'wix' | 'webflow';
  revalidate_url?: string;
  revalidate_secret?: string;
  // adapter creds (only the relevant ones for the chosen cms)
  url?: string; // webhook target
  secret?: string;
  base_url?: string; username?: string; app_password?: string; // wordpress
  api_token?: string; site_id?: string; collection_id?: string; // wix/webflow
};

export async function saveHeadlessConfig(config: HeadlessConfigForm) {
  const a = await auth();
  if ('error' in a) return a;
  const clean = Object.fromEntries(Object.entries(config).filter(([, v]) => v != null && v !== ''));
  const { error } = await a.supabase.from('channel_connections').upsert(
    { workspace_id: a.ws, channel: 'Headless', config: clean, active: true },
    { onConflict: 'workspace_id,channel' }
  );
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

/** Publish a content item to the headless feed (+ fire the ISR ping). */
export async function publishHeadless(input: { title: string; html: string; excerpt?: string; slug?: string; status?: 'draft' | 'published'; external_id?: string }) {
  const a = await auth();
  if ('error' in a) return a;
  if (!input.title?.trim() || !input.html?.trim()) return { error: 'bad_request' as const };
  const item = await upsertContent(a.supabase, a.ws, {
    external_id: input.external_id,
    title: input.title.trim(),
    slug: input.slug,
    html: input.html,
    excerpt: input.excerpt,
    status: input.status ?? 'published',
  });
  if (!item) return { error: 'store_failed' as const };
  const revalidated = item.status === 'published' ? await pingRevalidate(a.supabase, a.ws, item) : false;
  revalidate();
  return { ok: true, id: item.id, slug: item.slug, revalidated };
}
