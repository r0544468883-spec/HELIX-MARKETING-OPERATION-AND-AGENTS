'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createLanding } from '@/app/actions-landing';
import type { LandingTemplate } from '@/lib/landing/types';

export type LandingRow = { id: string; name: string; slug: string; vertical: string | null; published: boolean };
type TemplateLite = Pick<LandingTemplate, 'key' | 'vertical' | 'name'>;

const VERTICALS: [string, string][] = [
  ['ecommerce', '🛒 חנות'], ['saas', '☁️ SaaS'], ['clinic', '🩺 קליניקה'], ['realestate', '🏠 נדל״ן'],
  ['restaurant', '🍽️ מסעדה/מקומי'], ['agency', '📣 סוכנות'], ['b2b', '💼 B2B'], ['startup', '🚀 סטארטאפ'],
];

// Landing builder — pick industry → pick template → create (→ editor).
export default function LandingBuilder({ landings, templates, locale }: { landings: LandingRow[]; templates: TemplateLite[]; locale: string }) {
  const router = useRouter();
  const [vertical, setVertical] = useState('ecommerce');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const forV = templates.filter((t) => t.vertical === vertical);

  async function create(templateKey: string) {
    if (!name.trim()) return setMsg('תן שם לדף.');
    setBusy(templateKey); setMsg(null);
    const res = await createLanding({ templateKey, name: name.trim() });
    setBusy(null);
    if ('error' in res && res.error) return setMsg('שגיאה: ' + res.error);
    router.push(`/${locale}/landing/${(res as { id: string }).id}`);
  }

  return (
    <main className="max-w-[980px] mx-auto px-5 md:px-10 pt-8 pb-16" dir="rtl">
      <div className="text-[13px] font-bold text-emerald-600 mb-1">HELIX OPS</div>
      <h1 className="text-[clamp(22px,4vw,32px)] font-black tracking-tight mb-1">דפי נחיתה</h1>
      <p className="text-[14px] text-[var(--ink-secondary)] mb-6">בחר תחום → תבנית → ה-AI ממלא את התוכן. טופס לידים, וידאו (כולל אווטאר), וסגנונות UX — הכל כלול.</p>

      <input className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] mb-3 outline-none focus:border-black/30" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם הדף (למשל: השקת מוצר קיץ)" />

      <div className="flex flex-wrap gap-2 mb-4">
        {VERTICALS.map(([k, n]) => (
          <button key={k} onClick={() => setVertical(k)} className={`text-[13px] font-semibold rounded-lg px-3 py-1.5 border ${vertical === k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 text-[var(--ink-secondary)]'}`}>{n}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {forV.map((t) => (
          <button key={t.key} onClick={() => create(t.key)} disabled={!!busy}
            className="text-right rounded-2xl border border-black/10 bg-white p-4 hover:border-emerald-500 transition-colors disabled:opacity-50">
            <div className="text-[15px] font-bold">{t.name}</div>
            <div className="text-[11px] text-[var(--ink-secondary)] mt-1">{busy === t.key ? 'יוצר…' : 'בחר תבנית ←'}</div>
          </button>
        ))}
      </div>
      {msg && <p className="text-[14px] mb-4">{msg}</p>}

      <div className="text-[15px] font-bold mb-3">הדפים שלי</div>
      {landings.length === 0 ? <p className="text-[14px] text-[var(--ink-secondary)]">עדיין אין דפי נחיתה.</p> : (
        <div className="space-y-2">
          {landings.map((l) => (
            <Link key={l.id} href={`/${locale}/landing/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 hover:border-emerald-500 transition-colors">
              <div><div className="text-[14px] font-bold">{l.name}</div><div className="text-[12px] text-[var(--ink-secondary)]">/lp/{l.slug}</div></div>
              <span className="text-[12px] font-semibold text-emerald-600">{l.published ? 'פורסם' : 'טיוטה'} ←</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
