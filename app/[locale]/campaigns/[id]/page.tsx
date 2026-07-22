import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CampaignDetail, { type CampaignFull, type AssetRow, type VariantRow } from '@/components/CampaignDetail';

export const dynamic = 'force-dynamic';

export default async function CampaignDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: campaign } = await supabase
    .from('campaigns').select('id, name, goal, brief, channels').eq('id', id).maybeSingle();
  if (!campaign) notFound();

  const [{ data: assets }, { data: variants }] = await Promise.all([
    supabase.from('campaign_assets').select('id, channel, kind, budget, payload').eq('campaign_id', id),
    supabase.from('content_variants').select('id, campaign_asset_id, channel, angle, angle_index, variation_index, body, ai_score, is_winner')
      .in('campaign_asset_id', (await supabase.from('campaign_assets').select('id').eq('campaign_id', id)).data?.map((a) => a.id) ?? ['00000000-0000-0000-0000-000000000000']),
  ]);

  return (
    <CampaignDetail
      campaign={campaign as CampaignFull}
      assets={(assets ?? []) as AssetRow[]}
      variants={(variants ?? []) as VariantRow[]}
    />
  );
}
