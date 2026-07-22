import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingRenderer from '@/components/landing/LandingRenderer';
import type { Section, UxStyle } from '@/lib/landing/types';

export const dynamic = 'force-dynamic';

// Public landing page — anon read of a PUBLISHED page (RLS lp_public_read).
export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: lp } = await supabase.from('landing_pages').select('slug, sections, ux_style, published').eq('slug', slug).maybeSingle();
  if (!lp || !lp.published) notFound();

  return <LandingRenderer slug={lp.slug as string} sections={(lp.sections ?? []) as Section[]} uxStyle={(lp.ux_style as UxStyle) ?? 'minimal'} />;
}
