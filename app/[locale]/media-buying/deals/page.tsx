import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listPublisherDeals } from '@/app/actions-media-buying';
import PublisherDealsPipeline from '@/components/PublisherDealsPipeline';

export const dynamic = 'force-dynamic';

export default async function MediaBuyingDealsPage({
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

  const deals = await listPublisherDeals();

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-12 pb-16">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        רכש מדיה — דילים מול פאבלישרים
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8 max-w-[70ch]">
        המסלול ה-Managed: ניהול דילים ישירים מול פאבלישרים ישראליים (Ynet, Walla, ספורט, גלובס) שאין
        להם API. עקבו אחרי הדיל משלב ההצעה ועד לייב, כולל נפח מובטח, deadline וחשבונית. דילים
        פרוגרמטיים (PMP/PG) מקבלים Deal ID שעובר להרצה אוטומטית ב-DV360.
      </p>
      <PublisherDealsPipeline initial={deals} />
    </div>
  );
}
