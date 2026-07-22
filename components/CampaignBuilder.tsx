'use client';

import { useState } from 'react';
import { createCampaign } from '@/app/actions-campaigns';

export type CampaignRow = { id: string; name: string; goal: string | null; channels: string[]; status: string };

const CHANNELS: [string, string][] = [
  ['facebook', 'פייסבוק'], ['instagram', 'אינסטגרם'], ['linkedin', 'לינקדאין'], ['google_ads', 'Google Ads'], ['seo', 'SEO'],
];
const GOALS: [string, string][] = [
  ['leads', 'לידים'], ['sales', 'מכירות'], ['awareness', 'מודעות'], ['traffic', 'תנועה'],
];
const input = 'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none focus:border-black/30';
const label = 'block text-[13px] font-semibold mb-1';

// Campaign Builder — one brief + client persona + budget → full cross-channel
// campaign (each channel with up to 6 A/B variants). Same builder the bot uses.
export default function CampaignBuilder({ campaigns }: { campaigns: CampaignRow[] }) {
  const [rows, setRows] = useState<CampaignRow[]>(campaigns);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('leads');
  const [brief, setBrief] = useState('');
  const [channels, setChannels] = useState<string[]>(['facebook', 'instagram']);
  // Client profile (אפיון לקוח)
  const [audience, setAudience] = useState('');
  const [voice, setVoice] = useState('');
  const [product, setProduct] = useState('');
  // Budget
  const [total, setTotal] = useState('');
  const [variants, setVariants] = useState(6);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(c: string) {
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  async function submit() {
    if (!name.trim() || !brief.trim() || channels.length === 0) return setMsg('צריך שם, בריף, ולפחות ערוץ אחד.');
    setBusy(true); setMsg(null);
    const res = await createCampaign({
      name: name.trim(), goal, brief: brief.trim(), channels,
      clientProfile: { audience: audience.trim() || undefined, voice: voice.trim() || undefined, product: product.trim() || undefined },
      budget: total ? { total: Number(total), currency: 'ILS' } : undefined,
      variantsPerChannel: variants,
    });
    setBusy(false);
    if ('error' in res && res.error) return setMsg('שגיאה: ' + res.error);
    setRows((r) => [{ id: (res as { id: string }).id, name: name.trim(), goal, channels, status: 'ready' }, ...r]);
    setMsg('✅ הקמפיין נבנה — כולל וריאציות A/B לכל ערוץ. גלול לרשימה למטה.');
    setName(''); setBrief('');
  }

  return (
    <main className="max-w-[900px] mx-auto px-5 md:px-10 pt-8 pb-16" dir="rtl">
      <div className="mb-1 text-[13px] font-bold text-emerald-600">HELIX OPS</div>
      <h1 className="text-[clamp(22px,4vw,32px)] font-black tracking-tight mb-1">בונה קמפיינים</h1>
      <p className="text-[var(--ink-secondary)] text-[14px] mb-6">בריף אחד → קמפיין מלא בכל הערוצים, עם עד 6 וריאציות A/B לכל ערוץ. זמין גם דרך הבוט (וואטסאפ/טלגרם/מייל).</p>

      <div className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><span className={label}>שם הקמפיין</span><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="מבצע קיץ 2026" /></div>
          <div><span className={label}>מטרה</span><select className={input} value={goal} onChange={(e) => setGoal(e.target.value)}>{GOALS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
        </div>
        <div><span className={label}>בריף</span><textarea className={input + ' min-h-[90px]'} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="מה מקדמים, הצעה, מסר מרכזי…" /></div>

        <div>
          <span className={label}>ערוצים</span>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map(([k, n]) => (
              <button key={k} type="button" onClick={() => toggle(k)}
                className={`text-[13px] font-semibold rounded-lg px-3 py-1.5 border transition-colors ${channels.includes(k) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 text-[var(--ink-secondary)]'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* אפיון לקוח */}
        <div className="border-t border-black/5 pt-4">
          <div className="text-[13px] font-bold mb-2">אפיון לקוח</div>
          <div className="grid grid-cols-3 gap-3">
            <input className={input} value={product} onChange={(e) => setProduct(e.target.value)} placeholder="מוצר/שירות" />
            <input className={input} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="קהל יעד" />
            <input className={input} value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="טון מותג" />
          </div>
        </div>

        {/* תקציב + וריאציות */}
        <div className="grid grid-cols-2 gap-3 border-t border-black/5 pt-4">
          <div><span className={label}>תקציב כולל (₪) — יחולק בין הערוצים</span><input className={input} dir="ltr" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="10000" /></div>
          <div><span className={label}>וריאציות A/B לכל ערוץ</span><input className={input} type="number" min={1} max={6} value={variants} onChange={(e) => setVariants(Math.min(6, Math.max(1, Number(e.target.value))))} /></div>
        </div>

        <button onClick={submit} disabled={busy} className="rounded-xl bg-emerald-600 text-white px-6 py-3 text-[15px] font-bold disabled:opacity-50">
          {busy ? 'בונה קמפיין…' : 'בנה קמפיין'}
        </button>
        {msg && <p className="text-[14px]">{msg}</p>}
      </div>

      <div className="mt-8">
        <div className="text-[15px] font-bold mb-3">הקמפיינים שלי</div>
        {rows.length === 0 ? (
          <p className="text-[14px] text-[var(--ink-secondary)]">עדיין אין קמפיינים.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3">
                <div><div className="text-[14px] font-bold">{c.name}</div><div className="text-[12px] text-[var(--ink-secondary)]">{c.channels.join(' · ')}</div></div>
                <span className="text-[12px] font-semibold text-emerald-600">{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
