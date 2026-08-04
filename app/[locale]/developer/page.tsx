import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireFeature } from '@/lib/features/guard';
import DeveloperApi from '@/components/DeveloperApi';

export const dynamic = 'force-dynamic';

// Developer API — headless content distribution (Pull feed + on-demand ISR + CMS push).
// Lets a workspace expose its content to React/Next/Astro/Vue sites. Guarded by the
// `developer` feature toggle.
export default async function DeveloperPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireFeature('developer');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (!mem?.workspace_id) {
    return <DeveloperApi locale={locale} token={null} headlessConfig={{}} recent={[]} />;
  }

  const [{ data: ws }, { data: cc }, { data: recent }] = await Promise.all([
    supabase.from('workspaces').select('content_api_token').eq('id', mem.workspace_id).maybeSingle(),
    supabase.from('channel_connections').select('config').eq('workspace_id', mem.workspace_id).eq('channel', 'Headless').maybeSingle(),
    supabase.from('headless_content').select('id, title, slug, status, published_at').eq('workspace_id', mem.workspace_id).order('updated_at', { ascending: false }).limit(10),
  ]);

  return (
    <DeveloperApi
      locale={locale}
      token={(ws?.content_api_token as string | null) ?? null}
      headlessConfig={(cc?.config as Record<string, string>) ?? {}}
      recent={(recent ?? []) as { id: string; title: string; slug: string; status: string; published_at: string | null }[]}
    />
  );
}
