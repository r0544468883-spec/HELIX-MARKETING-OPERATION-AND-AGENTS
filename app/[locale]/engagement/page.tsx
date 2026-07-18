import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ExposureMeter, { type LimitRow, type ActionRow } from '@/components/ExposureMeter';

export const dynamic = 'force-dynamic';

export default async function EngagementPage({
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

  let limits: LimitRow[] = [];
  let actions: ActionRow[] = [];
  if (mem?.workspace_id) {
    const [{ data: lim }, { data: act }] = await Promise.all([
      supabase
        .from('engagement_limits')
        .select('channel, daily_cap, used_today, warmup_stage, risk_level, paused')
        .eq('workspace_id', mem.workspace_id),
      supabase
        .from('engagement_actions')
        .select('id, channel, type, content')
        .eq('workspace_id', mem.workspace_id)
        .eq('status', 'suggested')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    limits = (lim ?? []) as LimitRow[];
    actions = (act ?? []) as ActionRow[];
  }

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        Engagement — מד חשיפה
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        מכסות בטיחות per-רשת, kill-switch, ותור אישורים (HITL). קצב נמוך = מתחת לראדאר.
      </p>
      <ExposureMeter limits={limits} actions={actions} />
    </div>
  );
}
