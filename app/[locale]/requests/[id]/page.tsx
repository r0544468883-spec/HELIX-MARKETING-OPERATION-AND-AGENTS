import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProofingView from '@/components/ProofingView';
import ContentStudio, { type Draft } from '@/components/ContentStudio';
import DistributionPanel, { type Publication } from '@/components/DistributionPanel';
import type { Violation } from '@/lib/brand-linter';
import DeleteRequestButton from '@/components/DeleteRequestButton';
import VideoStudio from '@/components/VideoStudio';
import type { VideoTimeline } from '@/lib/video-timeline';

export const dynamic = 'force-dynamic';

type Comment = {
  id: string;
  x: number | null;
  y: number | null;
  body: string;
  resolved: boolean;
  created_at: string;
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: req } = await supabase
    .from('requests')
    .select('id, workspace_id, title, brief, status, channels, priority, due_date')
    .eq('id', id)
    .maybeSingle();
  if (!req) notFound();

  const { data: draftRows } = await supabase
    .from('content_drafts')
    .select('id, channel, language, body, ai_score, status')
    .eq('request_id', id)
    .order('channel', { ascending: true });
  const drafts = (draftRows ?? []) as Draft[];
  const readyChannels = drafts.filter((d) => d.status === 'ready').map((d) => d.channel);

  const { data: connRows } = await supabase
    .from('channel_connections')
    .select('channel')
    .eq('workspace_id', req.workspace_id)
    .eq('active', true);
  const connectedChannels = (connRows ?? []).map((c) => c.channel as string);

  const { data: pubRows } = await supabase
    .from('publications')
    .select('id, channel, status, error, scheduled_at, created_at')
    .eq('request_id', id)
    .order('created_at', { ascending: false });
  const publications = (pubRows ?? []) as Publication[];

  const { data: vp } = await supabase
    .from('video_projects')
    .select('timeline_json')
    .eq('request_id', id)
    .maybeSingle();
  const videoTimeline = (vp?.timeline_json ?? null) as VideoTimeline | null;

  const { data: guideRow } = await supabase
    .from('brand_guides')
    .select('workspace_id')
    .eq('workspace_id', req.workspace_id)
    .maybeSingle();
  const hasBrandGuide = !!guideRow;

  const { data: asset } = await supabase
    .from('assets')
    .select('id, current_version')
    .eq('request_id', id)
    .maybeSingle();

  let version: { id: string; version: number; image_url: string } | null = null;
  let comments: Comment[] = [];
  if (asset) {
    const { data: v } = await supabase
      .from('asset_versions')
      .select('id, version, image_url')
      .eq('asset_id', asset.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    version = v ?? null;
    if (v) {
      const { data: c } = await supabase
        .from('comments')
        .select('id, x, y, body, resolved, created_at')
        .eq('asset_version_id', v.id)
        .order('created_at', { ascending: true });
      comments = (c ?? []) as Comment[];
    }
  }

  let initialBrandCheck: { score: number; violations: Violation[] } | null = null;
  if (version) {
    const { data: bc } = await supabase
      .from('brand_checks')
      .select('score, violations')
      .eq('asset_version_id', version.id)
      .maybeSingle();
    if (bc) initialBrandCheck = { score: bc.score as number, violations: (bc.violations ?? []) as Violation[] };
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/${locale}/requests`} className="text-ink-secondary text-[14px] hover:text-ink transition-colors">
          ← חזרה לתור
        </Link>
        <DeleteRequestButton id={id} locale={locale} />
      </div>
      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mt-3" dir="auto">
        {req.title}
      </h1>
      {req.brief && (
        <p className="text-ink-secondary text-[15px] mt-2 max-w-[70ch]" dir="auto">
          {req.brief}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        {(req.channels ?? []).map((c: string) => (
          <span key={c} className="text-[12px] bg-surface border border-border rounded-full px-2.5 py-1 text-ink-secondary">
            {c}
          </span>
        ))}
      </div>

      <ContentStudio requestId={id} drafts={drafts} />

      <VideoStudio requestId={id} script={req.brief ?? req.title} initial={videoTimeline} />

      <ProofingView
        locale={locale}
        requestId={id}
        assetId={asset?.id ?? null}
        version={version}
        comments={comments}
        hasBrandGuide={hasBrandGuide}
        initialBrandCheck={initialBrandCheck}
      />

      <DistributionPanel
        requestId={id}
        readyChannels={readyChannels}
        connectedChannels={connectedChannels}
        publications={publications}
      />
    </div>
  );
}
