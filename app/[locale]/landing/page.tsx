import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingBuilder, { type LandingRow } from '@/components/LandingBuilder';
import { LANDING_TEMPLATES } from '@/lib/landing/templates';

export const dynamic = 'force-dynamic';

export default async function LandingIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();

  let landings: LandingRow[] = [];
  if (mem?.workspace_id) {
    const { data } = await supabase.from('landing_pages').select('id, name, slug, vertical, published').eq('workspace_id', mem.workspace_id).order('created_at', { ascending: false });
    landings = (data ?? []) as LandingRow[];
  }
  const templates = LANDING_TEMPLATES.map((t) => ({ key: t.key, vertical: t.vertical, name: t.name }));
  return <LandingBuilder landings={landings} templates={templates} locale={locale} />;
}
