'use client';

import { useState } from 'react';
import { setVariantWinner } from '@/app/actions-campaigns';

export type VariantRow = {
  id: string; campaign_asset_id: string; channel: string; angle: string | null;
  angle_index: number; variation_index: number; body: string; ai_score: number; is_winner: boolean;
};
export type AssetRow = { id: string; channel: string; kind: string; budget: number | null; payload: Record<string, unknown> };
export type CampaignFull = { id: string; name: string; goal: string | null; brief: string | null; channels: string[] };

const money = (n: number) => '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 });

// Campaign detail — per channel: social variants grouped by angle (each with AI
// score + "choose winner"), Google RSA, or the SEO plan.
export default function CampaignDetail({ campaign, assets, variants }: {
  campaign: CampaignFull; assets: AssetRow[]; variants: VariantRow[];
}) {
  const [rows, setRows] = useState<VariantRow[]>(variants);

  async function pickWinner(v: VariantRow) {
    setRows((rs) => rs.map((x) => (x.campaign_asset_id === v.campaign_asset_id ? { ...x, is_winner: x.id === v.id } : x)));
    await setVariantWinner(v.id, v.campaign_asset_id);
  }

  return (
    <main className="max-w-[980px] mx-auto px-5 md:px-10 pt-8 pb-16" dir="rtl">
      <div className="text-[13px] font-bold text-emerald-600 mb-1">HELIX OPS · קמפיין</div>
      <h1 className="text-[clamp(22px,4vw,30px)] font-black tracking-tight">{campaign.name}</h1>
      {campaign.brief && <p className="text-[14px] text-[var(--ink-secondary)] mt-1 mb-6">{campaign.brief}</p>}

      <div className="space-y-6">
        {assets.map((a) => (
          <section key={a.id} className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-bold">{a.channel}</h2>
              {a.budget != null && <span className="text-[13px] font-semibold text-emerald-600">{money(a.budget)}</span>}
            </div>

            {a.kind === 'social' && <SocialAsset assetId={a.id} variants={rows.filter((v) => v.campaign_asset_id === a.id)} onWinner={pickWinner} />}
            {a.kind === 'search_ads' && <RsaAsset payload={a.payload} />}
            {a.kind === 'seo' && <SeoAsset payload={a.payload} />}
          </section>
        ))}
      </div>
    </main>
  );
}

function SocialAsset({ variants, onWinner }: { assetId: string; variants: VariantRow[]; onWinner: (v: VariantRow) => void }) {
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
              <div key={v.id} className={`rounded-xl border p-3 ${v.is_winner ? 'border-emerald-500 bg-emerald-50/40' : 'border-black/10'}`}>
                <div className="text-[13px] whitespace-pre-wrap mb-2">{v.body}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--ink-secondary)]">אנושיות: {v.ai_score}/100</span>
                  <button onClick={() => onWinner(v)} className={`text-[11px] font-bold rounded-lg px-2.5 py-1 ${v.is_winner ? 'bg-emerald-600 text-white' : 'bg-black/5 hover:bg-black/10'}`}>
                    {v.is_winner ? '★ מנצח' : 'בחר מנצח'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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
