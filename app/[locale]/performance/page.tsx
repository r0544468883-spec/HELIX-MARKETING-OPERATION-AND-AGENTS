import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/features/guard';

export const dynamic = 'force-dynamic';

// Performance module — creative scoring, swapping & budget prioritization.
// Skeleton behind the `performance` feature toggle; the scoring engine (Phase 1)
// fills in next. Guarded so only workspaces with the feature on can reach it.
export default async function PerformancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireFeature('performance');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const he = locale !== 'en';

  return (
    <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-10" dir={he ? 'rtl' : 'ltr'}>
      <h1 className="font-display font-black text-2xl md:text-3xl tracking-tight">
        {he ? 'פרפורמנס' : 'Performance'}
      </h1>
      <p className="mt-3 text-ink-secondary max-w-2xl">
        {he
          ? 'מנוע סקורינג לקריאייטיבים, החלפה אוטומטית ותעדוף תקציב. השלד מוכן — מנוע הסקור נכנס בשלב הבא.'
          : 'Creative scoring, automatic swapping and budget prioritization. Skeleton is live — the scoring engine lands next.'}
      </p>
    </div>
  );
}
