'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { setVariantWinner, buildNextAsset, publishVariants, autoPickWinner } from '@/app/actions-campaigns';

export type VariantRow = {
  id: string; campaign_asset_id: string; channel: string; angle: string | null;
  angle_index: number; variation_index: number; body: string; ai_score: number; is_winner: boolean; published?: boolean;
};
export type AssetRow = { id: string; channel: string; kind: string; budget: number | null; status?: string; payload: Record<string, unknown> };
export type CampaignFull = { id: string; name: string; goal: string | null; brief: string | null; channels: string[] };

const money = (n: number) => '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 });

// Campaign detail — per channel: social variants grouped by angle (each with AI
// score + "choose winner"), Google RSA, or the SEO plan.
export default function CampaignDetail({ campaign, assets, variants, pending }: {
  campaign: CampaignFull; assets: AssetRow[]; variants: VariantRow[]; pending: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<VariantRow[]>(variants);
  const [building, setBuilding] = useState(pending > 0);
  const [note, setNote] = useState<string | null>(null);
  const runningRef = useRef(false);

  // Progressive build — build ONE channel per call, refreshing between each, so
  // the user watches channels fill in one at a time (never all 108 at once).
  useEffect(() => {
    if (pending <= 0 || runningRef.current) return;
    runningRef.current = true;
    (async () => {
      const res = await buildNextAsset(campaign.id);
      if ('error' in res && res.error) { setNote('שגיאה בבנייה: ' + res.error); setBuilding(false); return; }
      if ('done' in res && res.done) { setBuilding(false); router.refresh(); return; }
      router.refresh(); // re-render with the just-built channel; effect re-runs for the next
    })().finally(() => { runningRef.current = false; });
  }, [pending, campaign.id, router]);

  async function pickWinner(v: VariantRow) {
    setRows((rs) => rs.map((x) => (x.campaign_asset_id === v.campaign_asset_id ? { ...x, is_winner: x.id === v.id } : x)));
    await setVariantWinner(v.id, v.campaign_asset_id);
  }
  async function auto(assetId: string) {
    const res = await autoPickWinner(assetId);
    if ('winnerId' in res && res.winnerId) {
      setRows((rs) => rs.map((x) => (x.campaign_asset_id === assetId ? { ...x, is_winner: x.id === res.winnerId } : x)));
      setNote(`נבחר מנצח אוטומטית (לפי ${res.basis === 'performance' ? 'ביצועים' : 'ציון אנושיות'}).`);
    }
  }

  return (
    <main className="max-w-[980px] mx-auto px-5 md:px-10 pt-8 pb-16" dir="rtl">
      <div className="text-[13px] font-bold text-emerald-600 mb-1">HELIX OPS · קמפיין</div>
      <h1 className="text-[clamp(22px,4vw,30px)] font-black tracking-tight">{campaign.name}</h1>
      {campaign.brief && <p className="text-[14px] text-[var(--ink-secondary)] mt-1 mb-4">{campaign.brief}</p>}

      {building && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/40 px-4 py-3 mb-5 text-[14px] font-semibold text-emerald-700">
          ⏳ בונה את הערוצים אחד-אחרי-השני… ({assets.filter((a) => a.status !== 'pending').length}/{assets.length}) — התוכן מופיע בהדרגה.
        </div>
      )}
      {note && <div className="rounded-xl bg-black/5 px-4 py-2 mb-5 text-[13px]">{note}</div>}

      <div className="space-y-6">
        {assets.map((a) => (
          <section key={a.id} className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-[16px] font-bold">{a.channel}{a.status === 'pending' && <span className="mr-2 text-[12px] font-normal text-[var(--ink-secondary)]">⏳ בתור…</span>}</h2>
              <div className="flex items-center gap-2">
                {a.budget != null && <span className="text-[13px] font-semibold text-emerald-600">{money(a.budget)}</span>}
                {a.kind === 'social' && a.status !== 'pending' && (
                  <button onClick={() => auto(a.id)} className="text-[12px] font-bold rounded-lg bg-black/5 hover:bg-black/10 px-3 py-1.5">בחר מנצח אוטומטית</button>
                )}
              </div>
            </div>

            {a.status === 'pending'
              ? <p className="text-[13px] text-[var(--ink-secondary)]">ממתין לבנייה…</p>
              : <>
                  {a.kind === 'social' && <SocialAsset assetId={a.id} variants={rows.filter((v) => v.campaign_asset_id === a.id)} onWinner={pickWinner} />}
                  {a.kind === 'search_ads' && <RsaAsset payload={a.payload} />}
                  {a.kind === 'seo' && <SeoAsset payload={a.payload} />}
                </>}
          </section>
        ))}
      </div>
    </main>
  );
}

function SocialAsset({ variants, onWinner }: { assetId: string; variants: VariantRow[]; onWinner: (v: VariantRow) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'organic' | 'paid' | 'video'>('organic');
  const [mediaUrl, setMediaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [pubNote, setPubNote] = useState<string | null>(null);
  const [pub, setPub] = useState<Set<string>>(new Set(variants.filter((v) => v.published).map((v) => v.id)));

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function publishSelected() {
    if (selected.size === 0) return setPubNote('בחר לפחות גרסה אחת.');
    if (mode === 'video' && !mediaUrl.trim()) return setPubNote('מצב סרטון דורש קישור וידאו.');
    setBusy(true); setPubNote(null);
    const res = await publishVariants({ variantIds: [...selected], mode, mediaUrl: mediaUrl.trim() || undefined });
    setBusy(false);
    if ('error' in res && res.error) return setPubNote('שגיאה: ' + res.error);
    setPub((p) => new Set([...p, ...[...selected]]));
    setSelected(new Set());
    setPubNote(`✅ פורסמו ${(res as { sent: number }).sent} גרסאות (${modeLabel(mode)}).`);
  }

  // Group by angle_index.
  const byAngle = new Map<number, VariantRow[]>();
  for (const v of variants.sort((a, b) => a.variation_index - b.variation_index)) {
    const list = byAngle.get(v.angle_index) ?? [];
    list.push(v); byAngle.set(v.angle_index, list);
  }

  return (
    <div className="space-y-4">
      {[...byAngle.entries()].sort((a, b) => a[0] - b[0]).map(([ai, list]) => (
        <div key={ai}>
          <div className="text-[13px] font-bold text-[var(--ink-secondary)] mb-2">סגנון {ai + 1}: {list[0]?.angle}</div>
          <div className="grid md:grid-cols-2 gap-2">
            {list.map((v) => (
              <div key={v.id} className={`rounded-xl border p-3 ${selected.has(v.id) ? 'border-emerald-500 ring-1 ring-emerald-300' : v.is_winner ? 'border-emerald-400 bg-emerald-50/40' : 'border-black/10'}`}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-1 accent-emerald-600" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
                  <div className="text-[13px] whitespace-pre-wrap flex-1">{v.body}</div>
                </label>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-[var(--ink-secondary)]">אנושיות: {v.ai_score}/100 {pub.has(v.id) && <span className="text-emerald-600 font-bold">· פורסם ✓</span>}</span>
                  <button onClick={() => onWinner(v)} className={`text-[11px] font-bold rounded-lg px-2.5 py-1 ${v.is_winner ? 'bg-emerald-600 text-white' : 'bg-black/5 hover:bg-black/10'}`}>
                    {v.is_winner ? '★ מנצח' : 'סמן מנצח'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Multi-variant publish bar — organic / paid / video, several at once */}
      <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold">פרסום ({selected.size} נבחרו):</span>
        <div className="flex gap-1">
          {(['organic', 'paid', 'video'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`text-[12px] font-semibold rounded-lg px-3 py-1.5 border ${mode === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 text-[var(--ink-secondary)]'}`}>{modeLabel(m)}</button>
          ))}
        </div>
        {(mode === 'video' || mode === 'paid') && (
          <input className="rounded-lg border border-black/10 px-3 py-1.5 text-[12px] flex-1 min-w-[160px]" dir="ltr" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={mode === 'video' ? 'קישור וידאו (חובה)' : 'קישור מדיה (אופציונלי)'} />
        )}
        <button onClick={publishSelected} disabled={busy || selected.size === 0} className="text-[12px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-1.5 disabled:opacity-50">
          {busy ? 'מפרסם…' : `פרסם נבחרים`}
        </button>
        {pubNote && <span className="text-[12px] w-full">{pubNote}</span>}
      </div>
    </div>
  );
}

function modeLabel(m: 'organic' | 'paid' | 'video'): string {
  return m === 'organic' ? 'תוכן אורגני' : m === 'paid' ? 'ממומן' : 'סרטון';
}

function RsaAsset({ payload }: { payload: Record<string, unknown> }) {
  const rsa = (payload.rsa ?? {}) as { headlines?: string[]; descriptions?: string[]; keywords?: string[] };
  return (
    <div className="space-y-3 text-[13px]">
      <Block title={`כותרות (${rsa.headlines?.length ?? 0})`} items={rsa.headlines ?? []} />
      <Block title={`תיאורים (${rsa.descriptions?.length ?? 0})`} items={rsa.descriptions ?? []} />
      <Block title="מילות מפתח" items={rsa.keywords ?? []} inline />
    </div>
  );
}

function SeoAsset({ payload }: { payload: Record<string, unknown> }) {
  const plan = (payload.plan ?? {}) as { primaryKeyword?: string; title?: string; keywords?: { term: string; intent: string }[]; outline?: string[] };
  return (
    <div className="space-y-3 text-[13px]">
      <div><b>מילת מפתח ראשית:</b> {plan.primaryKeyword}</div>
      <div><b>כותרת מוצעת:</b> {plan.title}</div>
      <Block title="מילות מפתח" items={(plan.keywords ?? []).map((k) => `${k.term} (${k.intent})`)} inline />
      <Block title="Outline" items={plan.outline ?? []} />
    </div>
  );
}

function Block({ title, items, inline }: { title: string; items: string[]; inline?: boolean }) {
  return (
    <div>
      <div className="font-bold text-[var(--ink-secondary)] mb-1">{title}</div>
      {inline ? (
        <div className="flex flex-wrap gap-1.5">{items.map((s, i) => <span key={i} className="rounded-full bg-black/5 px-2 py-0.5 text-[12px]">{s}</span>)}</div>
      ) : (
        <ul className="list-disc pr-5 space-y-0.5">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
      )}
    </div>
  );
}
