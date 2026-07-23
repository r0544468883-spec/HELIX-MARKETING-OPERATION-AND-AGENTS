import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CoachStudio from '@/components/CoachStudio';

export const dynamic = 'force-dynamic';

// מאמן תוכן ונוכחות — ציון 0-100 לטיוטות (לפני פרסום) ולפרופילים, לפי ערוץ.
export default async function CoachPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  return <CoachStudio />;
}
