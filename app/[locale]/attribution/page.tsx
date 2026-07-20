import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MarketingManager, {
  type CampaignRow,
  type CityRow,
  type SequenceRow,
  type EmailLogRow,
} from '@/components/MarketingManager';

export const dynamic = 'force-dynamic';

// Attribution + Sequences dashboard — reads the mkt_* tables (migration-v14) and
// computes ROI-per-campaign from visits→paid, top cities, and sequence health.
export default async function AttributionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: mem } = await supabase
    .from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();

  let campaigns: CampaignRow[] = [];
  let cities: CityRow[] = [];
  let sequences: SequenceRow[] = [];
  let emailLog: EmailLogRow[] = [];

  if (mem?.workspace_id) {
    const ws = mem.workspace_id;
    const [{ data: visitors }, { data: seqs }, { data: steps }, { data: enrolls }, { data: logs }] = await Promise.all([
      supabase.from('mkt_visitors').select('utm_campaign, utm_source, city, payment_status, payment_amount').eq('workspace_id', ws).limit(5000),
      supabase.from('mkt_sequences').select('id, name, status').eq('workspace_id', ws).order('created_at', { ascending: false }),
      supabase.from('mkt_sequence_steps').select('sequence_id'),
      supabase.from('mkt_sequence_enrollments').select('sequence_id, status'),
      supabase.from('mkt_email_log').select('email_to, subject, status, sent_at, opened_at, clicked_at').order('sent_at', { ascending: false }).limit(50),
    ]);

    // ── Aggregate ROI per campaign ──
    const cMap = new Map<string, CampaignRow>();
    const cityMap = new Map<string, number>();
    for (const v of visitors ?? []) {
      const key = v.utm_campaign || '(ללא קמפיין)';
      const row = cMap.get(key) ?? { campaign: key, source: v.utm_source || '—', visits: 0, conversions: 0, revenue: 0 };
      row.visits++;
      if (v.payment_status === 'paid') { row.conversions++; row.revenue += Number(v.payment_amount || 0); }
      cMap.set(key, row);
      if (v.city) cityMap.set(v.city, (cityMap.get(v.city) ?? 0) + 1);
    }
    campaigns = [...cMap.values()].sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);
    cities = [...cityMap.entries()].map(([city, visits]) => ({ city, visits })).sort((a, b) => b.visits - a.visits).slice(0, 10);

    // ── Sequence health ──
    const stepCount = new Map<string, number>();
    for (const s of steps ?? []) stepCount.set(s.sequence_id, (stepCount.get(s.sequence_id) ?? 0) + 1);
    const activeEnroll = new Map<string, number>();
    for (const e of enrolls ?? []) if (e.status === 'active') activeEnroll.set(e.sequence_id, (activeEnroll.get(e.sequence_id) ?? 0) + 1);
    sequences = (seqs ?? []).map((s) => ({
      id: s.id, name: s.name, status: s.status,
      steps: stepCount.get(s.id) ?? 0, activeEnrollments: activeEnroll.get(s.id) ?? 0,
    }));
    emailLog = (logs ?? []) as EmailLogRow[];
  }

  return <MarketingManager campaigns={campaigns} cities={cities} sequences={sequences} emailLog={emailLog} />;
}
