import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MediaLibrary, { type ClientRow, type AssetRow } from '@/components/MediaLibrary';

export const dynamic = 'force-dynamic';

export default async function MediaPage({
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

  let clients: ClientRow[] = [];
  let assets: AssetRow[] = [];
  if (mem?.workspace_id) {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('client_profiles').select('id, name').eq('workspace_id', mem.workspace_id).order('name'),
      supabase
        .from('media_assets')
        .select('id, asset_ref, title, topic, target_networks, status')
        .eq('workspace_id', mem.workspace_id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    clients = (c ?? []) as ClientRow[];
    assets = (a ?? []) as AssetRow[];
  }

  return (
    <div className="max-w-[760px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        Media Library
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        זרקו מדיה מוכנה + מטא-דאטה → הסוכן כותב כיתוב per-רשת (בעברית אנושית) ומתזמן אוטומטית.
      </p>
      <MediaLibrary clients={clients} assets={assets} />
    </div>
  );
}
