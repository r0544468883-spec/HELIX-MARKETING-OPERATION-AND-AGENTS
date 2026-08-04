import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWhatsApp } from '../distribution/whatsapp';
import type { ChannelConfig } from '../distribution/types';
import type { ScoredCreative } from './engine';

// WhatsApp activity updates — the "direct mobile notifications about account activity"
// piece. After a performance run, if the workspace opted in, send a short Hebrew summary
// of what the agent did (paused/scaled/promoted) to the operator's WhatsApp. Reuses the
// existing WhatsApp Cloud API sender + the workspace's 'וואטסאפ' channel connection.
// Degrades silently when WhatsApp isn't configured or notifications are off.

type DB = SupabaseClient;

// The channel label under which a WhatsApp connection is stored (HE + EN aliases).
const WA_CHANNELS = ['וואטסאפ', 'whatsapp', 'WhatsApp'];

async function whatsappConfig(db: DB, workspaceId: string): Promise<ChannelConfig | null> {
  const { data } = await db
    .from('channel_connections')
    .select('channel, config')
    .eq('workspace_id', workspaceId)
    .in('channel', WA_CHANNELS)
    .limit(1)
    .maybeSingle();
  return (data?.config as ChannelConfig) ?? null;
}

const ACTION_HE: Record<string, string> = {
  pause: '⏸️ הושהה',
  scale_up: '📈 הוגדל תקציב',
  scale_down: '📉 הוקטן תקציב',
  promote: '🚀 הועלה לאוויר',
  keep: '✓ נשמר',
};

/** Compose a short Hebrew activity digest from a run's scored creatives + counts. */
export function composeActivityMessage(scored: ScoredCreative[], recorded: number, applied: number): string | null {
  const actionable = scored.filter((s) => s.action !== 'keep');
  if (actionable.length === 0) return null;

  const lines = actionable.slice(0, 8).map((s) => `${ACTION_HE[s.action] ?? s.action} — ${s.creative.name} (ציון ${Math.round(s.score.blended)})`);
  const header = `🤖 HELIX OPS — עדכון ביצועים`;
  const summary = applied > 0 ? `${recorded} החלטות, ${applied} בוצעו אוטומטית` : `${recorded} החלטות ממתינות לאישור`;
  const more = actionable.length > 8 ? `\n…ועוד ${actionable.length - 8}` : '';
  return `${header}\n${summary}\n\n${lines.join('\n')}${more}`;
}

/**
 * Send the activity digest to WhatsApp if the workspace enabled it. Returns whether a
 * message was actually sent. Never throws — notification failure must not fail the run.
 */
export async function notifyActivity(db: DB, workspaceId: string, scored: ScoredCreative[], recorded: number, applied: number): Promise<boolean> {
  try {
    const { data: settings } = await db.from('performance_settings').select('notify_whatsapp').eq('workspace_id', workspaceId).maybeSingle();
    if (!settings?.notify_whatsapp) return false;

    const message = composeActivityMessage(scored, recorded, applied);
    if (!message) return false;

    const cfg = await whatsappConfig(db, workspaceId);
    if (!cfg) return false;
    const r = await sendWhatsApp(cfg, message);
    return r.ok;
  } catch {
    return false;
  }
}
