import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { makeRunner, type OllamaCfg, type Tier } from '@/lib/agentos/model-router';
import { getHandler } from '@/lib/agentos/registry';
import { composeDigest, collectChannels, type DigestSection } from '@/lib/agentos/digest';
import { sendToChannel } from '@/lib/distribution';

export const dynamic = 'force-dynamic';

// HELIX Agent OS scheduler. Wire to a Vercel Cron (e.g. hourly); protect with
// ?secret=DIGEST_SECRET. Each tick: run every active agent, group by workspace,
// compose one digest, and deliver it. MVP runs all active agents per tick;
// cron/timezone gating can filter later via agents.schedule_cron.
type AgentRow = {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  model_tier: Tier;
};

export async function GET(req: Request) {
  const secret = process.env.DIGEST_SECRET;
  const provided = new URL(req.url).searchParams.get('secret');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin_client' }, { status: 500 });

  const { data: agents } = await admin
    .from('agents')
    .select('id, workspace_id, name, type, config, model_tier')
    .eq('active', true);

  // Group agents by workspace.
  const byWs = new Map<string, AgentRow[]>();
  for (const a of (agents ?? []) as AgentRow[]) {
    const list = byWs.get(a.workspace_id) ?? [];
    list.push(a);
    byWs.set(a.workspace_id, list);
  }

  const today = new Date().toISOString().slice(0, 10);
  let workspacesDone = 0;
  let sent = 0;

  for (const [workspaceId, wsAgents] of byWs) {
    // Resolve this workspace's Ollama endpoint (or null → Claude only).
    const { data: ep } = await admin
      .from('ollama_endpoints')
      .select('base_url, model, api_key')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    const ollama: OllamaCfg = ep
      ? { baseUrl: ep.base_url as string, model: ep.model as string, apiKey: (ep.api_key as string) ?? undefined }
      : null;
    const run = makeRunner(ollama);

    const sections: DigestSection[] = [];
    for (const agent of wsAgents) {
      const handler = getHandler(agent.type);
      if (!handler) {
        await admin.from('agent_runs').insert({
          agent_id: agent.id,
          workspace_id: workspaceId,
          status: 'fail',
          error: 'unknown_type',
        });
        continue;
      }
      try {
        const res = await handler({ config: agent.config, tier: agent.model_tier, run });
        sections.push({ title: agent.name, body: res.body });
        await admin.from('agent_runs').insert({
          agent_id: agent.id,
          workspace_id: workspaceId,
          status: 'ok',
          output_md: res.body,
          model_used: res.model,
        });
      } catch (e) {
        await admin.from('agent_runs').insert({
          agent_id: agent.id,
          workspace_id: workspaceId,
          status: 'fail',
          error: (e as Error).message,
        });
      }
    }

    const body = composeDigest(sections, today);
    const channels = collectChannels(wsAgents.map((a) => a.config));

    let delivered = false;
    for (const channel of channels) {
      const { data: conn } = await admin
        .from('channel_connections')
        .select('config')
        .eq('workspace_id', workspaceId)
        .eq('channel', channel)
        .maybeSingle();
      if (!conn) continue;
      const res = await sendToChannel(channel, conn.config as Record<string, unknown>, body);
      if (res.ok) delivered = true;
    }

    await admin.from('digests').insert({
      workspace_id: workspaceId,
      digest_date: today,
      body_md: body,
      channels,
      sent_at: delivered ? new Date().toISOString() : null,
    });

    workspacesDone++;
    if (delivered) sent++;
  }

  return NextResponse.json({ workspaces: workspacesDone, digests_sent: sent });
}
