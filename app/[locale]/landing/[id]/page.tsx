import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingEditor, { type Landing } from '@/components/LandingEditor';

export const dynamic = 'force-dynamic';

export default async function LandingEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: lp } = await supabase.from('landing_pages').select('id, name, slug, ux_style, published, sections').eq('id', id).maybeSingle();
  if (!lp) notFound();
  return <LandingEditor landing={lp as Landing} />;
}
