import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FunnelsManager, { type FunnelRow } from '@/components/FunnelsManager';

export const dynamic = 'force-dynamic';

export default async function FunnelsPage({
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

  let funnels: FunnelRow[] = [];
  if (mem?.workspace_id) {
    const { data } = await supabase
      .from('comment_funnels')
      .select('id, channel, keyword, public_reply_text, dm_message, tier, active')
      .eq('workspace_id', mem.workspace_id)
      .order('created_at', { ascending: false });
    funnels = (data ?? []) as FunnelRow[];
  }

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        Comment-to-DM Funnels
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        מישהו מגיב במילת טריגר לפוסט שלך → הבוט מגיב פומבי ושולח לו הודעה פרטית עם הפרטים.
      </p>
      <FunnelsManager initial={funnels} />
    </div>
  );
}
