import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TemplatesManager from '@/components/TemplatesManager';

export const dynamic = 'force-dynamic';

// ניהול תבניות WhatsApp — צפייה בתבניות המובנות והעלאת/עריכת/מחיקת תבניות מותאמות.
export default async function TemplatesPage({
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

  return (
    <div className="max-w-[860px] mx-auto px-5 md:px-10 pt-12 pb-16">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        ניהול תבניות WhatsApp
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        צפייה בתבניות המובנות והעלאת תבניות משלך. תבנית מותאמת עם אותו מפתח דורסת את
        המובנית. אחרי שמירה — הריצו סנכרון ואשרו את התבנית ב-WhatsApp Manager לפני שליחה מחוץ לחלון 24 שעות.
      </p>
      <TemplatesManager workspaceId={(mem?.workspace_id as string) ?? null} />
    </div>
  );
}
