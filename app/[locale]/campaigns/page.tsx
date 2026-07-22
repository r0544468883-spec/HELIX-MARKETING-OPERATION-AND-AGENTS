import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CampaignBuilder, { type CampaignRow } from '@/components/CampaignBuilder';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();

  let campaigns: CampaignRow[] = [];
  if (mem?.workspace_id) {
    const { data } = await supabase
      .from('campaigns').select('id, name, goal, channels, status').eq('workspace_id', mem.workspace_id).order('created_at', { ascending: false });
    campaigns = (data ?? []) as CampaignRow[];
  }

  return <CampaignBuilder campaigns={campaigns} />;
}
