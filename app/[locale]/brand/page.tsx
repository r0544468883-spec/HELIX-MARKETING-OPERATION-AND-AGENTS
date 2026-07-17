import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import BrandGuideForm from '@/components/BrandGuideForm';

export const dynamic = 'force-dynamic';

export default async function BrandPage({
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

  let initial = null;
  if (mem?.workspace_id) {
    const { data } = await supabase
      .from('brand_guides')
      .select('colors, fonts, logo_url, disclaimers, notes')
      .eq('workspace_id', mem.workspace_id)
      .maybeSingle();
    initial = data;
  }

  return (
    <div className="max-w-[680px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        קווי מותג
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        הגדירו את חוקי המותג — הלינטר יבדוק כל נכס מולם ויתריע על חריגות.
      </p>
      <BrandGuideForm initial={initial} />
    </div>
  );
}
