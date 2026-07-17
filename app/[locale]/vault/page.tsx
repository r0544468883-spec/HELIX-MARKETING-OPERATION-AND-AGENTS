import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type VaultItem = { id: string; title: string; image: string };

export default async function VaultPage({
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

  let items: VaultItem[] = [];
  if (mem?.workspace_id) {
    const { data } = await supabase
      .from('requests')
      .select('id, title, status, assets(id, asset_versions(image_url, version))')
      .eq('workspace_id', mem.workspace_id)
      .in('status', ['approved', 'done']);

    items = ((data ?? []) as unknown as {
      id: string;
      title: string;
      assets?: { asset_versions?: { image_url: string | null; version: number }[] }[];
    }[])
      .map((r) => {
        const versions = r.assets?.[0]?.asset_versions ?? [];
        const latest = [...versions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
        return { id: r.id, title: r.title, image: latest?.image_url ?? null };
      })
      .filter((x): x is VaultItem => !!x.image);
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        כספת מותג
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">כל הנכסים המאושרים במקום אחד.</p>

      {items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-ink-secondary text-[15px]">
          אין עדיין נכסים מאושרים.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/${locale}/requests/${it.id}`}
              className="group bg-surface border border-border rounded-xl overflow-hidden hover:border-brand hover:-translate-y-1 hover:shadow-lg transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image} alt={it.title} className="w-full aspect-square object-cover" />
              <div className="p-2 text-[13px] font-semibold truncate" dir="auto">
                {it.title}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
