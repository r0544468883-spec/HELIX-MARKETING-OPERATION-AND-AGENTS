import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RequestForm from '@/components/RequestForm';

export const dynamic = 'force-dynamic';

export default async function NewRequestPage({
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

  return (
    <div className="max-w-[680px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        בקשת תוכן חדשה
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">מלאו את הפרטים והבקשה תיכנס לתור.</p>
      <RequestForm locale={locale} />
    </div>
  );
}
