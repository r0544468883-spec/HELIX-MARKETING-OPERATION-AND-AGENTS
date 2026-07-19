import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RadarManager, { type RadarRow, type LeadRow } from '@/components/RadarManager';

export const dynamic = 'force-dynamic';

export default async function RadarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: mem } = await supabase
    .from('memberships')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  let radars: RadarRow[] = [];
  let leads: LeadRow[] = [];
  if (mem?.workspace_id) {
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase
        .from('radar_configs')
        .select('id, name, keywords, min_intent, alert_channels, active')
        .eq('workspace_id', mem.workspace_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('radar_leads')
        .select('id, source, post_url, content, intent_score, matched, status')
        .eq('workspace_id', mem.workspace_id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    radars = (r ?? []) as RadarRow[];
    leads = (l ?? []) as LeadRow[];
  }

  return (
    <div className="max-w-[760px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        Lead Radar
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        גילוי לידים בזמן אמת מקבוצות פייסבוק ורשתות — לפי מילות מפתח וכוונת קנייה. ליד חם → התראה →
        המרה לפנייה.
      </p>
      <RadarManager radars={radars} leads={leads} />
    </div>
  );
}
