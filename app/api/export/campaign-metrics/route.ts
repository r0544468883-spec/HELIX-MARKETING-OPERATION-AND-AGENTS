import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Cross-product export — HELIX DASHBOARDS pulls campaign A/B metrics from here and
// normalizes them into its metric_points. Per (campaign × channel): impressions /
// views / clicks summed across variants, + variant count. Secret-protected.
// GET ?workspace=<opsWorkspaceId>&secret=<EXPORT_SECRET>
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.EXPORT_SECRET;
  const provided = url.searchParams.get('secret') || req.headers.get('x-export-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const ws = url.searchParams.get('workspace');
  if (!ws) return NextResponse.json({ error: 'workspace_required' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin' }, { status: 500 });

  const [{ data: campaigns }, { data: assets }, { data: variants }] = await Promise.all([
    admin.from('campaigns').select('id, name').eq('workspace_id', ws),
    admin.from('campaign_assets').select('id, campaign_id, channel').eq('workspace_id', ws),
    admin.from('content_variants').select('campaign_asset_id, impressions, views, clicks').eq('workspace_id', ws),
  ]);

  const campName = new Map((campaigns ?? []).map((c) => [c.id as string, c.name as string]));
  const assetMeta = new Map((assets ?? []).map((a) => [a.id as string, { campaign: campName.get(a.campaign_id as string) ?? 'campaign', channel: a.channel as string }]));

  // Aggregate per (campaign, channel).
  const agg = new Map<string, { campaign: string; channel: string; impressions: number; views: number; clicks: number; variants: number }>();
  for (const v of variants ?? []) {
    const meta = assetMeta.get(v.campaign_asset_id as string);
    if (!meta) continue;
    const key = `${meta.campaign}|${meta.channel}`;
    const row = agg.get(key) ?? { ...meta, impressions: 0, views: 0, clicks: 0, variants: 0 };
    row.impressions += (v.impressions as number) ?? 0;
    row.views += (v.views as number) ?? 0;
    row.clicks += (v.clicks as number) ?? 0;
    row.variants += 1;
    agg.set(key, row);
  }

  // Emit metric_points-ready rows (ts stamped by the consumer to avoid clock issues).
  const points: { metric: string; dims: Record<string, string>; value: number }[] = [];
  for (const r of agg.values()) {
    const dims = { campaign: r.campaign, channel: r.channel };
    points.push({ metric: 'campaign_impressions', dims, value: r.impressions });
    points.push({ metric: 'campaign_views', dims, value: r.views });
    points.push({ metric: 'campaign_clicks', dims, value: r.clicks });
    points.push({ metric: 'campaign_variants', dims, value: r.variants });
  }
  return NextResponse.json({ points });
}
