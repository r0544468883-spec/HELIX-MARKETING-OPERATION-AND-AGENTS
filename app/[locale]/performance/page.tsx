import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/features/guard';
import { scoreWorkspace } from '@/lib/performance/engine';
import { availableOAuthPlatforms } from '@/lib/performance/oauth';
import PerformanceDashboard from '@/components/PerformanceDashboard';
import PerformanceTools from '@/components/PerformanceTools';

export const dynamic = 'force-dynamic';

// Performance module — creative scoring (Bayesian: AI prior + client-baseline data),
// swapping & budget prioritization. Guarded by the `performance` feature toggle.
export default async function PerformancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const { status: connectStatus } = await searchParams;
  await requireFeature('performance');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();

  // No workspace yet → empty dashboard (the client component handles onboarding).
  if (!mem?.workspace_id) {
    return <PerformanceDashboard locale={locale} settings={null} scored={[]} decisions={[]} />;
  }

  const { settings, scored } = await scoreWorkspace(supabase, mem.workspace_id);

  // Tools-panel data: branding + report token, connected channels, available OAuth apps.
  const [{ data: ws }, { data: channels }] = await Promise.all([
    supabase.from('workspaces').select('branding, report_token').eq('id', mem.workspace_id).maybeSingle(),
    supabase.from('channel_connections').select('channel').eq('workspace_id', mem.workspace_id),
  ]);
  const connected = ((channels ?? []) as { channel: string }[]).map((c) => c.channel);
  const { data: decisions } = await supabase
    .from('performance_decisions')
    .select('id, creative_id, action, reason, score, confidence, status, created_at')
    .eq('workspace_id', mem.workspace_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <>
    <PerformanceTools
      locale={locale}
      oauthPlatforms={availableOAuthPlatforms()}
      connected={connected}
      branding={(ws?.branding as Record<string, string>) ?? {}}
      reportToken={(ws?.report_token as string | null) ?? null}
      notifyWhatsapp={Boolean((settings as { notify_whatsapp?: boolean }).notify_whatsapp)}
      connectStatus={connectStatus}
    />
    <PerformanceDashboard
      locale={locale}
      settings={settings}
      scored={scored.map((s) => ({
        id: s.creative.id,
        name: s.creative.name,
        platform: s.creative.platform,
        status: s.creative.status,
        coldStart: s.score.coldStart,
        inFlight: s.score.inFlight,
        confidence: s.score.confidence,
        blended: s.score.blended,
        value: s.score.value,
        action: s.action,
        reason: s.reason,
        coldReason: s.creative.cold_reason,
      }))}
      decisions={(decisions ?? []) as never[]}
    />
    </>
  );
}
