import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AgentsManager, { type AgentRow, type OllamaRow } from '@/components/AgentsManager';

export const dynamic = 'force-dynamic';

export default async function AgentsPage({
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

  let agents: AgentRow[] = [];
  let ollama: OllamaRow | null = null;
  if (mem?.workspace_id) {
    const [{ data: a }, { data: o }] = await Promise.all([
      supabase
        .from('agents')
        .select('id, name, type, model_tier, config, active')
        .eq('workspace_id', mem.workspace_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('ollama_endpoints')
        .select('mode, base_url, model')
        .eq('workspace_id', mem.workspace_id)
        .maybeSingle(),
    ]);
    agents = (a ?? []) as AgentRow[];
    ollama = (o ?? null) as OllamaRow | null;
  }

  return (
    <div className="max-w-[760px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-2">
        HELIX Daily — סוכנים
      </h1>
      <p className="text-ink-secondary text-[15px] mb-8">
        סוכנים מתוזמנים שמרכיבים דייג'סט יומי אחד. Ollama מקומי לנפח, Claude לאיכות עברית.
      </p>
      <AgentsManager agents={agents} ollama={ollama} />
    </div>
  );
}
