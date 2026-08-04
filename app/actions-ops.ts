'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateChannelDraft } from '@/lib/content-agent';
import { sendToChannel } from '@/lib/distribution';
import { runBrandCheck, type BrandGuide } from '@/lib/brand-linter';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Get the user's current workspace, creating a personal one on first use. */
async function currentWorkspace(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data: mem } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (mem?.workspace_id) return mem.workspace_id as string;

  const { data: wsId } = await supabase.rpc('create_workspace', { ws_name: 'הסביבה שלי' });
  return (wsId as string) ?? null;
}

export async function signOut(locale: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}

export type RequestInput = {
  title: string;
  brief: string;
  channels: string[];
  due_date: string | null;
  priority: string;
  locale: string;
};

export async function createRequest(input: RequestInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };

  const { error } = await supabase.from('requests').insert({
    workspace_id: ws,
    requester_id: user.id,
    title: input.title,
    brief: input.brief || null,
    channels: input.channels,
    due_date: input.due_date || null,
    priority: input.priority,
  });
  if (error) return { error: error.message };

  revalidatePath(`/${input.locale}/requests`);
  redirect(`/${input.locale}/requests`);
}

export async function deleteRequest(id: string, locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/${locale}/requests`);
  redirect(`/${locale}/requests`);
}

export async function updateRequestStatus(id: string, status: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { error } = await supabase
    .from('requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------- Approval flow ----------

/** Create (or bump the version of) the request's asset with a newly uploaded image. */
export async function addAssetVersion(requestId: string, imageUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: req } = await supabase
    .from('requests')
    .select('workspace_id')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return { error: 'not_found' };

  let assetId: string;
  let version = 1;
  const { data: asset } = await supabase
    .from('assets')
    .select('id, current_version')
    .eq('request_id', requestId)
    .maybeSingle();

  if (asset) {
    assetId = asset.id as string;
    version = (asset.current_version as number) + 1;
    await supabase.from('assets').update({ current_version: version }).eq('id', assetId);
  } else {
    const { data: created, error: aErr } = await supabase
      .from('assets')
      .insert({ request_id: requestId, workspace_id: req.workspace_id })
      .select('id')
      .single();
    if (aErr || !created) return { error: aErr?.message ?? 'asset_failed' };
    assetId = created.id as string;
  }

  const { error } = await supabase
    .from('asset_versions')
    .insert({ asset_id: assetId, version, image_url: imageUrl, created_by: user.id });
  if (error) return { error: error.message };

  await supabase
    .from('requests')
    .update({ status: 'review', updated_at: new Date().toISOString() })
    .eq('id', requestId);
  return { ok: true };
}

export async function addComment(
  assetVersionId: string,
  x: number | null,
  y: number | null,
  body: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data, error } = await supabase
    .from('comments')
    .insert({ asset_version_id: assetVersionId, author_id: user.id, x, y, body })
    .select('id, x, y, body, resolved, created_at')
    .single();
  if (error) return { error: error.message };
  return { ok: true, comment: data };
}

export async function decideApproval(
  assetId: string,
  requestId: string,
  decision: 'approved' | 'changes_requested',
  note: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { error } = await supabase
    .from('approvals')
    .insert({ asset_id: assetId, approver_id: user.id, decision, note: note || null });
  if (error) return { error: error.message };

  const newStatus = decision === 'approved' ? 'approved' : 'in_progress';
  await supabase
    .from('requests')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId);
  return { ok: true };
}

// ---------- Content Agent ----------

/** Generate a per-channel draft for every channel on the request (Claude). */
export async function generateDrafts(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: req } = await supabase
    .from('requests')
    .select('workspace_id, title, brief, channels')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return { error: 'not_found' };

  const channels: string[] = (req.channels ?? []).length ? (req.channels as string[]) : ['מייל'];

  try {
    const results = await Promise.all(
      channels.map(async (ch) => ({ channel: ch, ...(await generateChannelDraft(req.brief ?? '', req.title, ch)) }))
    );
    for (const r of results) {
      await supabase.from('content_drafts').upsert(
        {
          request_id: requestId,
          workspace_id: req.workspace_id,
          channel: r.channel,
          language: r.language,
          body: r.body,
          ai_score: r.aiScore,
          status: 'draft',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'request_id,channel' }
      );
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { ok: true };
}

export async function updateDraft(draftId: string, body: string, status: 'draft' | 'ready') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { error } = await supabase
    .from('content_drafts')
    .update({ body, status, updated_at: new Date().toISOString() })
    .eq('id', draftId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function regenerateDraft(draftId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: d } = await supabase
    .from('content_drafts')
    .select('request_id, channel')
    .eq('id', draftId)
    .maybeSingle();
  if (!d) return { error: 'not_found' };

  const { data: req } = await supabase
    .from('requests')
    .select('title, brief')
    .eq('id', d.request_id)
    .maybeSingle();
  if (!req) return { error: 'not_found' };

  try {
    const g = await generateChannelDraft(req.brief ?? '', req.title, d.channel as string);
    const { error } = await supabase
      .from('content_drafts')
      .update({ body: g.body, ai_score: g.aiScore, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', draftId);
    if (error) return { error: error.message };
    return { ok: true, body: g.body, aiScore: g.aiScore };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------- Distribution ----------

/** Publish the request's 'ready' drafts to their connected channels. whenISO=null → send now. */
export async function publishDrafts(requestId: string, whenISO: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: req } = await supabase
    .from('requests')
    .select('workspace_id')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return { error: 'not_found' };
  const workspaceId = req.workspace_id as string;

  const { data: drafts } = await supabase
    .from('content_drafts')
    .select('channel, body')
    .eq('request_id', requestId)
    .eq('status', 'ready');
  if (!drafts || drafts.length === 0) return { error: 'no_ready_drafts' };

  const { data: conns } = await supabase
    .from('channel_connections')
    .select('channel, config')
    .eq('workspace_id', workspaceId)
    .eq('active', true);
  const connByChannel = new Map(
    (conns ?? []).map((c) => [c.channel as string, c.config as Record<string, unknown>])
  );

  let sent = 0;
  let failed = 0;
  let queued = 0;
  let skipped = 0;

  for (const d of drafts) {
    const channel = d.channel as string;
    const config = connByChannel.get(channel);
    const content = (d.body as string) ?? '';
    if (!config) {
      skipped++;
      continue;
    }
    if (whenISO) {
      await supabase.from('publications').insert({
        workspace_id: workspaceId,
        request_id: requestId,
        channel,
        content,
        scheduled_at: whenISO,
        status: 'pending',
      });
      queued++;
    } else {
      const res = await sendToChannel(channel, config, content);
      await supabase.from('publications').insert({
        workspace_id: workspaceId,
        request_id: requestId,
        channel,
        content,
        status: res.ok ? 'sent' : 'failed',
        external_id: res.externalId ?? null,
        error: res.ok ? null : res.error ?? 'error',
        sent_at: res.ok ? new Date().toISOString() : null,
      });
      if (res.ok) sent++;
      else failed++;
    }
  }

  // if everything sent, move the request to done
  if (!whenISO && failed === 0 && sent > 0) {
    await supabase
      .from('requests')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', requestId);
  }

  return { ok: true, sent, failed, queued, skipped };
}

export async function saveChannelConnection(
  channel: string,
  config: Record<string, unknown>,
  active: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: mem } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.workspace_id) return { error: 'no_workspace' };

  const { error } = await supabase.from('channel_connections').upsert(
    { workspace_id: mem.workspace_id, channel, config, active },
    { onConflict: 'workspace_id,channel' }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

// Link a WhatsApp number to the current workspace so the operator bot answers
// with THIS workspace's data (same bot_links mechanism the Telegram bot resolves).
// Phone is normalised to bare international digits (matches the wa_id Meta sends).
export async function linkWhatsApp(phone: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const ws = await currentWorkspace(supabase, user.id);
  if (!ws) return { error: 'no_workspace' };

  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length < 8) return { error: 'invalid_phone' };

  const { error } = await supabase.from('bot_links').upsert(
    { channel: 'whatsapp', identifier: digits, workspace_id: ws },
    { onConflict: 'channel,identifier' }
  );
  if (error) return { error: error.message };
  return { ok: true, identifier: digits };
}

// ---------- Video Studio ----------

export async function saveVideoTimeline(requestId: string, timeline: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: req } = await supabase
    .from('requests')
    .select('workspace_id')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return { error: 'not_found' };

  const { error } = await supabase.from('video_projects').upsert(
    {
      request_id: requestId,
      workspace_id: req.workspace_id,
      timeline_json: timeline,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'request_id' }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setVideoRendered(requestId: string, videoUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const { error } = await supabase
    .from('video_projects')
    .update({ video_url: videoUrl, status: 'ready', updated_at: new Date().toISOString() })
    .eq('request_id', requestId);
  if (error) return { error: error.message };
  return { ok: true };
}

// ---------- Phase 2: Brand Vault + Linter ----------

export type BrandGuideInput = {
  colors: string[];
  fonts: string[];
  logo_url: string | null;
  disclaimers: string[];
  notes: string;
};

export async function saveBrandGuide(guide: BrandGuideInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: mem } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!mem?.workspace_id) return { error: 'no_workspace' };

  const { error } = await supabase.from('brand_guides').upsert(
    {
      workspace_id: mem.workspace_id,
      colors: guide.colors,
      fonts: guide.fonts,
      logo_url: guide.logo_url,
      disclaimers: guide.disclaimers,
      notes: guide.notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

/** Run the brand linter (Claude vision) on an asset version against the workspace guide. */
export async function runLint(assetVersionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };

  const { data: v } = await supabase
    .from('asset_versions')
    .select('id, image_url, asset_id')
    .eq('id', assetVersionId)
    .maybeSingle();
  if (!v) return { error: 'not_found' };

  const { data: a } = await supabase
    .from('assets')
    .select('workspace_id')
    .eq('id', v.asset_id)
    .maybeSingle();
  if (!a) return { error: 'not_found' };

  const { data: guide } = await supabase
    .from('brand_guides')
    .select('colors, fonts, logo_url, disclaimers, notes')
    .eq('workspace_id', a.workspace_id)
    .maybeSingle();
  if (!guide) return { error: 'no_guide' };

  try {
    const result = await runBrandCheck(v.image_url as string, guide as BrandGuide);
    await supabase.from('brand_checks').upsert(
      {
        asset_version_id: assetVersionId,
        score: result.score,
        violations: result.violations,
        checked_at: new Date().toISOString(),
      },
      { onConflict: 'asset_version_id' }
    );
    return { ok: true, score: result.score, violations: result.violations };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
