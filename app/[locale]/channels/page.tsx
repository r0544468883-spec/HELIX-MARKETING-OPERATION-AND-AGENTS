import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChannelConnections from '@/components/ChannelConnections';

export const dynamic = 'force-dynamic';

type Conn = { channel: string; config: Record<string, unknown>; active: boolean };

export default async function ChannelsPage({
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

  let initial: Conn[] = [];
  if (mem?.workspace_id) {
    const { data } = await supabase
      .from('channel_connections')
      .select('channel, config, active')
      .eq('workspace_id', mem.workspace_id);
    initial = (data ?? []) as Conn[];
  }

  return (
    <div className="max-w-[680px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        חיבורי ערוצים
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        חברו את הערוצים כדי לאפשר הפצה. טלגרם ומייל עובדים מיד; וואטסאפ דורש WhatsApp Cloud API.
      </p>
      <ChannelConnections initial={initial} />
    </div>
  );
}
