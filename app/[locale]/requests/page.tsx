import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RequestBoard, { type Req } from '@/components/RequestBoard';
import GettingStarted from '@/components/GettingStarted';

export const dynamic = 'force-dynamic';

export default async function RequestsPage({
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

  let requests: Req[] = [];
  let hasBrand = false;
  let hasChannel = false;
  if (mem?.workspace_id) {
    const { data } = await supabase
      .from('requests')
      .select('id, title, brief, channels, due_date, priority, status')
      .eq('workspace_id', mem.workspace_id)
      .order('created_at', { ascending: false });
    requests = (data ?? []) as Req[];

    const { data: bg } = await supabase
      .from('brand_guides')
      .select('workspace_id')
      .eq('workspace_id', mem.workspace_id)
      .maybeSingle();
    hasBrand = !!bg;

    const { data: cc } = await supabase
      .from('channel_connections')
      .select('channel')
      .eq('workspace_id', mem.workspace_id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    hasChannel = !!cc;
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <GettingStarted
        locale={locale}
        hasBrand={hasBrand}
        hasChannel={hasChannel}
        hasRequest={requests.length > 0}
      />
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight">
            תור הבקשות
          </h1>
          <p className="text-ink-secondary text-[15px] mt-1">
            גררו בקשות בין העמודות לעדכון סטטוס.
          </p>
        </div>
        <Link
          href={`/${locale}/requests/new`}
          className="bg-brand hover:bg-brand-hover text-bg font-bold px-5 py-2.5 rounded-[10px] transition-colors"
        >
          + בקשה חדשה
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-ink-secondary text-[16px]">אין עדיין בקשות.</p>
          <Link
            href={`/${locale}/requests/new`}
            className="inline-block mt-4 bg-brand hover:bg-brand-hover text-bg font-semibold px-5 py-2.5 rounded-[10px] transition-colors"
          >
            צרו את הראשונה
          </Link>
        </div>
      ) : (
        <RequestBoard initial={requests} locale={locale} />
      )}
    </div>
  );
}
