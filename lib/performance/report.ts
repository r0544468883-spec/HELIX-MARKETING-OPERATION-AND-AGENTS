import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// White-label client report — the "client-ready reports with agency branding" piece.
// Aggregates the workspace's creatives + latest metrics + the agent's decisions over a
// period into a single branded, print-to-PDF HTML page. Branding (name/logo/color/footer)
// comes from workspaces.branding; a public report_token lets an agency share a read-only
// link with their client without a login.

type DB = SupabaseClient;

export type Branding = {
  brand_name?: string;
  logo_url?: string;
  primary_color?: string; // hex
  footer?: string;
};

export type ReportRow = {
  name: string;
  platform: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number; // %
  cpa: number | null; // ₪
  roas: number | null;
};

export type ReportData = {
  workspaceName: string;
  branding: Branding;
  periodDays: number;
  generatedAt: string;
  totals: { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; ctr: number; cpa: number | null; roas: number | null };
  rows: ReportRow[];
  actions: { pause: number; scale_up: number; scale_down: number; promote: number };
};

function derive(spend: number, impressions: number, clicks: number, conversions: number, revenue: number) {
  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpa: conversions > 0 ? spend / conversions : null,
    roas: spend > 0 ? revenue / spend : null,
  };
}

/** Gather the report dataset for a workspace over the last `days`. */
export async function buildReport(db: DB, workspaceId: string, days = 30): Promise<ReportData> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const [{ data: ws }, { data: creatives }, { data: metrics }, { data: decisions }] = await Promise.all([
    db.from('workspaces').select('name, branding').eq('id', workspaceId).maybeSingle(),
    db.from('creatives').select('id, name, platform, status').eq('workspace_id', workspaceId).neq('status', 'retired'),
    db.from('creative_metrics').select('creative_id, spend, impressions, clicks, conversions, revenue, as_of').eq('workspace_id', workspaceId).gte('as_of', since).order('as_of', { ascending: false }),
    db.from('performance_decisions').select('action').eq('workspace_id', workspaceId).gte('created_at', since),
  ]);

  // Latest metric snapshot per creative within the window.
  const latest = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number; revenue: number }>();
  type MetricRow = { creative_id: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };
  for (const m of (metrics ?? []) as MetricRow[]) {
    const id = m.creative_id;
    if (latest.has(id)) continue;
    latest.set(id, {
      spend: Number(m.spend) || 0,
      impressions: Number(m.impressions) || 0,
      clicks: Number(m.clicks) || 0,
      conversions: Number(m.conversions) || 0,
      revenue: Number(m.revenue) || 0,
    });
  }

  const rows: ReportRow[] = [];
  const t = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
  for (const c of (creatives ?? []) as { id: string; name: string; platform: string; status: string }[]) {
    const m = latest.get(c.id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    const d = derive(m.spend, m.impressions, m.clicks, m.conversions, m.revenue);
    rows.push({ name: c.name, platform: c.platform, status: c.status, ...m, ...d });
    t.spend += m.spend; t.impressions += m.impressions; t.clicks += m.clicks; t.conversions += m.conversions; t.revenue += m.revenue;
  }
  rows.sort((a, b) => b.spend - a.spend);

  const actions = { pause: 0, scale_up: 0, scale_down: 0, promote: 0 };
  for (const d of (decisions ?? []) as { action: keyof typeof actions }[]) {
    if (d.action in actions) actions[d.action]++;
  }

  return {
    workspaceName: (ws?.name as string) || 'Workspace',
    branding: ((ws?.branding as Branding) ?? {}) || {},
    periodDays: days,
    generatedAt: new Date().toISOString(),
    totals: { ...t, ...derive(t.spend, t.impressions, t.clicks, t.conversions, t.revenue) },
    rows,
    actions,
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const nis = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;
const int = (n: number) => Math.round(n).toLocaleString('he-IL');
const pct = (n: number) => `${n.toFixed(2)}%`;

/** Render the report as a standalone, RTL, print-to-PDF HTML document. */
export function renderReportHtml(data: ReportData): string {
  const b = data.branding;
  const color = b.primary_color && /^#[0-9a-fA-F]{3,8}$/.test(b.primary_color) ? b.primary_color : '#0ea5e9';
  const brand = esc(b.brand_name || data.workspaceName);
  const logo = b.logo_url ? `<img src="${esc(b.logo_url)}" alt="${brand}" style="height:44px;object-fit:contain"/>` : `<div style="font-size:24px;font-weight:800;color:${color}">${brand}</div>`;
  const date = new Date(data.generatedAt).toLocaleDateString('he-IL');
  const T = data.totals;

  const kpi = (label: string, value: string) => `<div class="kpi"><div class="kv">${value}</div><div class="kl">${label}</div></div>`;
  const rows = data.rows
    .map(
      (r) => `<tr>
      <td class="name">${esc(r.name)}</td>
      <td>${esc(r.platform)}</td>
      <td><span class="badge b-${esc(r.status)}">${esc(r.status)}</span></td>
      <td>${nis(r.spend)}</td>
      <td>${int(r.impressions)}</td>
      <td>${int(r.clicks)}</td>
      <td>${pct(r.ctr)}</td>
      <td>${int(r.conversions)}</td>
      <td>${r.cpa === null ? '—' : nis(r.cpa)}</td>
      <td>${r.roas === null ? '—' : r.roas.toFixed(2)}</td>
    </tr>`
    )
    .join('');

  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${brand} — דוח ביצועים</title>
<style>
  :root{--c:${color}}
  *{box-sizing:border-box}
  body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f6f8fb;color:#0f172a;padding:24px}
  .sheet{max-width:1000px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(2,6,23,.08);overflow:hidden}
  header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px;border-bottom:3px solid var(--c)}
  header .meta{text-align:left;color:#64748b;font-size:13px}
  h1{font-size:20px;margin:20px 28px 4px}
  .sub{color:#64748b;margin:0 28px 20px;font-size:14px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:0 28px 8px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px}
  .kv{font-size:22px;font-weight:800;color:var(--c)}
  .kl{font-size:12px;color:#64748b;margin-top:2px}
  .acts{display:flex;gap:10px;flex-wrap:wrap;padding:16px 28px;color:#334155;font-size:13px}
  .acts span{background:#eff6ff;border:1px solid #dbeafe;border-radius:999px;padding:4px 12px}
  table{width:100%;border-collapse:collapse;margin:8px 0 0}
  th,td{padding:10px 12px;text-align:right;font-size:13px;border-bottom:1px solid #eef2f7}
  th{background:#f8fafc;color:#475569;font-weight:600;position:sticky;top:0}
  td.name{font-weight:600;max-width:220px}
  .badge{font-size:11px;padding:2px 8px;border-radius:999px}
  .b-live{background:#dcfce7;color:#166534}.b-paused{background:#fee2e2;color:#991b1b}.b-draft{background:#f1f5f9;color:#475569}
  footer{padding:18px 28px;color:#94a3b8;font-size:12px;border-top:1px solid #eef2f7;text-align:center}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0}th{position:static}}
</style></head>
<body><div class="sheet">
  <header>${logo}<div class="meta">דוח ביצועים · ${data.periodDays} ימים אחרונים<br/>${date}</div></header>
  <h1>סיכום ביצועים</h1>
  <p class="sub">${esc(data.workspaceName)} · הופק אוטומטית ע״י HELIX OPS</p>
  <div class="kpis">
    ${kpi('הוצאה', nis(T.spend))}
    ${kpi('חשיפות', int(T.impressions))}
    ${kpi('CTR', pct(T.ctr))}
    ${kpi('המרות', int(T.conversions))}
    ${kpi('CPA', T.cpa === null ? '—' : nis(T.cpa))}
    ${kpi('ROAS', T.roas === null ? '—' : T.roas.toFixed(2))}
    ${kpi('קליקים', int(T.clicks))}
    ${kpi('הכנסה', nis(T.revenue))}
  </div>
  <div class="acts">
    <span>⏸️ הושהו: ${data.actions.pause}</span>
    <span>📈 הוגדלו: ${data.actions.scale_up}</span>
    <span>📉 הוקטנו: ${data.actions.scale_down}</span>
    <span>🚀 עלו לאוויר: ${data.actions.promote}</span>
  </div>
  <table>
    <thead><tr><th>קריאייטיב</th><th>פלטפורמה</th><th>סטטוס</th><th>הוצאה</th><th>חשיפות</th><th>קליקים</th><th>CTR</th><th>המרות</th><th>CPA</th><th>ROAS</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:32px">אין נתונים בתקופה זו</td></tr>'}</tbody>
  </table>
  <footer>${esc(b.footer || `הופק ע״י ${b.brand_name || 'HELIX OPS'} · ${date}`)}</footer>
</div></body></html>`;
}
