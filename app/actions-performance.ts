'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { runWorkspace, launchCreativeOnPlatform, type PerfSettings } from '@/lib/performance/engine';
import { getConnector, type ChannelConfig, type AdRef } from '@/lib/performance/connectors';
import type { Metric } from '@/lib/performance/scoring';
import { learnStyleProfile } from '@/lib/performance/style-profile';
import { buildAndLaunch, type CampaignBrief } from '@/lib/performance/campaign-builder';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Current user's workspace (first membership). */
async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
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

const REVALIDATE = ['/he/performance', '/en/performance'];
function revalidate() {
  for (const p of REVALIDATE) revalidatePath(p);
}

// ── Creative pool ──
export type CreativeInputForm = {
  name: string;
  platform: string;
  format?: string;
  headline?: string;
  body?: string;
  hook?: string;
  media_url?: string;
  external_ref?: { adId?: string; adsetId?: string };
};

export async function addCreative(input: CreativeInputForm) {
  const a = await auth();
  if ('error' in a) return a;
  if (!input.name?.trim() || !input.platform?.trim()) return { error: 'bad_request' as const };

  const { error } = await a.supabase.from('creatives').insert({
    workspace_id: a.ws,
    name: input.name.trim(),
    platform: input.platform.trim(),
    format: input.format?.trim() || null,
    headline: input.headline?.trim() || null,
    body: input.body?.trim() || null,
    hook: input.hook?.trim() || null,
    media_url: input.media_url?.trim() || null,
    external_ref: input.external_ref ?? {},
    status: 'draft',
  });
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function setCreativeStatus(id: string, status: 'draft' | 'live' | 'paused' | 'retired') {
  const a = await auth();
  if ('error' in a) return a;
  const { error } = await a.supabase.from('creatives').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', a.ws);
  if (error) return { error: error.message };
  // Going live in connector mode → upload it to the platform (best-effort; never blocks).
  let uploaded = false;
  if (status === 'live') uploaded = await launchCreativeOnPlatform(a.supabase, a.ws, id);
  revalidate();
  return { ok: true, uploaded };
}

// ── Settings ──
export async function saveSettings(patch: Partial<PerfSettings>) {
  const a = await auth();
  if ('error' in a) return a;
  const { error } = await a.supabase.from('performance_settings').upsert(
    { workspace_id: a.ws, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id' }
  );
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

export async function setMetric(metric: Metric) {
  return saveSettings({ metric });
}

// ── Style learning: infer naming/budget/preferences from the workspace's own history ──
export async function learnStyle() {
  const a = await auth();
  if ('error' in a) return a;
  const profile = await learnStyleProfile(a.supabase, a.ws);
  revalidate();
  return { ok: true, profile };
}

// ── AI campaign builder: brief → styled spec → seed pool → (connector) build on platform ──
export async function buildCampaign(brief: CampaignBrief) {
  const a = await auth();
  if ('error' in a) return a;
  if (!brief?.platform?.trim() || !brief?.product?.trim()) return { error: 'bad_request' as const };
  const r = await buildAndLaunch(a.supabase, a.ws, brief);
  revalidate();
  return r;
}

// ── White-label report: branding + a shareable public token ──
export type BrandingForm = { brand_name?: string; logo_url?: string; primary_color?: string; footer?: string };

export async function setBranding(branding: BrandingForm) {
  const a = await auth();
  if ('error' in a) return a;
  const clean: BrandingForm = {
    brand_name: branding.brand_name?.trim() || undefined,
    logo_url: branding.logo_url?.trim() || undefined,
    primary_color: branding.primary_color?.trim() || undefined,
    footer: branding.footer?.trim() || undefined,
  };
  const { error } = await a.supabase.from('workspaces').update({ branding: clean }).eq('id', a.ws);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

/** Create (once) the public report token for this workspace and return the share URL. */
export async function ensureReportToken() {
  const a = await auth();
  if ('error' in a) return a;
  const { data: ws } = await a.supabase.from('workspaces').select('report_token').eq('id', a.ws).maybeSingle();
  let token = ws?.report_token as string | null;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, '');
    const { error } = await a.supabase.from('workspaces').update({ report_token: token }).eq('id', a.ws);
    if (error) return { error: error.message };
  }
  return { ok: true, token, path: `/report/${token}` };
}

// ── Run the loop now (score → record decisions) ──
export async function runNow() {
  const a = await auth();
  if ('error' in a) return a;
  const r = await runWorkspace(a.supabase, a.ws);
  revalidate();
  return { ok: true, recorded: r.recorded, applied: r.applied };
}

// ── Approve / reject a pending decision ──
export async function resolveDecision(id: string, approve: boolean) {
  const a = await auth();
  if ('error' in a) return a;

  const { data: dec } = await a.supabase
    .from('performance_decisions')
    .select('id, creative_id, action, status')
    .eq('id', id)
    .eq('workspace_id', a.ws)
    .maybeSingle();
  if (!dec || dec.status !== 'pending') return { error: 'not_pending' as const };

  if (!approve) {
    await a.supabase.from('performance_decisions').update({ status: 'rejected' }).eq('id', id);
    revalidate();
    return { ok: true };
  }

  // Approved: reflect the intended state change. For pause we flip the creative and,
  // in connector mode with an adId + Meta config, also call the platform.
  const action = dec.action as string;
  if (action === 'pause' && dec.creative_id) {
    const { data: settings } = await a.supabase.from('performance_settings').select('execution_mode').eq('workspace_id', a.ws).maybeSingle();
    const { data: c } = await a.supabase.from('creatives').select('platform, external_ref').eq('id', dec.creative_id).maybeSingle();
    // Connector mode → also pause on the actual platform (any supported: Meta/TikTok/Google/Outbrain).
    if (settings?.execution_mode === 'connector' && c) {
      const conn = getConnector(c.platform as string);
      const ref = (c.external_ref as AdRef) ?? {};
      if (conn) {
        const { data: cc } = await a.supabase.from('channel_connections').select('config').eq('workspace_id', a.ws).eq('channel', c.platform).maybeSingle();
        if (cc?.config) await conn.pauseAd(cc.config as ChannelConfig, ref);
      }
    }
    await a.supabase.from('creatives').update({ status: 'paused' }).eq('id', dec.creative_id).eq('workspace_id', a.ws);
  } else if ((action === 'promote') && dec.creative_id) {
    await a.supabase.from('creatives').update({ status: 'live' }).eq('id', dec.creative_id).eq('workspace_id', a.ws);
  }

  await a.supabase.from('performance_decisions').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', id);
  revalidate();
  return { ok: true };
}
