// Learning Loop — turns post performance into insights that improve future
// scheduling/content. Reads post_performance, finds the best posting hour per
// network by average engagement, and stores it in learning_insights. The
// Media Auto-Ingest then schedules new posts at that hour.
import type { SupabaseClient } from '@supabase/supabase-js';

// Return the next ISO timestamp at the learned best hour for a network,
// or null if we don't have an insight yet (→ publish immediately).
export async function bestHour(
  admin: SupabaseClient,
  workspaceId: string,
  network: string
): Promise<string | null> {
  const { data } = await admin
    .from('learning_insights')
    .select('value')
    .eq('workspace_id', workspaceId)
    .eq('network', network)
    .eq('insight_type', 'best_hour')
    .maybeSingle();

  const hour = (data?.value as { hour?: number } | undefined)?.hour;
  if (hour == null || hour < 0 || hour > 23) return null;

  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.toISOString();
}

// Recompute best-hour insights from performance data. Join performance with the
// publication's sent_at, bucket by hour, and pick the hour with highest average
// engagement per network. Idempotent upsert into learning_insights.
export async function recomputeInsights(admin: SupabaseClient, workspaceId: string): Promise<number> {
  const { data: perf } = await admin
    .from('post_performance')
    .select('network, engagement, publications(sent_at)')
    .eq('workspace_id', workspaceId)
    .limit(2000);

  // network -> hour -> { sum, count }
  type PubRel = { sent_at: string | null } | { sent_at: string | null }[] | null;
  type PerfRow = { network: string; engagement: number | null; publications: PubRel };
  const buckets = new Map<string, Map<number, { sum: number; count: number }>>();
  for (const row of (perf ?? []) as unknown as PerfRow[]) {
    const pub = Array.isArray(row.publications) ? row.publications[0] : row.publications;
    const sentAt = pub?.sent_at;
    if (!sentAt || row.engagement == null) continue;
    const hour = new Date(sentAt).getHours();
    const net = buckets.get(row.network) ?? new Map();
    const cell = net.get(hour) ?? { sum: 0, count: 0 };
    cell.sum += row.engagement;
    cell.count += 1;
    net.set(hour, cell);
    buckets.set(row.network, net);
  }

  let written = 0;
  for (const [network, hours] of buckets) {
    let bestH = -1;
    let bestAvg = -1;
    let total = 0;
    for (const [hour, cell] of hours) {
      total += cell.count;
      const avg = cell.sum / cell.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestH = hour;
      }
    }
    if (bestH < 0) continue;
    await admin.from('learning_insights').upsert(
      {
        workspace_id: workspaceId,
        network,
        insight_type: 'best_hour',
        value: { hour: bestH, avg_engagement: Math.round(bestAvg) },
        confidence: Math.min(1, total / 30), // more samples → higher confidence
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,network,insight_type' }
    );
    written++;
  }
  return written;
}
