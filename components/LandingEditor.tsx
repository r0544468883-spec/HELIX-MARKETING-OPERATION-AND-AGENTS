'use client';

import { useState } from 'react';
import { updateLandingSections, setLandingStyle, publishLanding, aiFillLanding } from '@/app/actions-landing';
import { UX_STYLES, type Section, type UxStyle } from '@/lib/landing/types';

export type Landing = { id: string; name: string; slug: string; ux_style: UxStyle; published: boolean; sections: Section[] };

const inp = 'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black/30';

// Form-based landing editor — edit each block's text, choose a UX style, AI-fill,
// preview, publish. Structured (no raw HTML) so it stays safe and templated.
export default function LandingEditor({ landing }: { landing: Landing }) {
  const [sections, setSections] = useState<Section[]>(landing.sections);
  const [style, setStyle] = useState<UxStyle>(landing.ux_style);
  const [published, setPublished] = useState(landing.published);
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Update a top-level string field of section i.
  function set(i: number, patch: Partial<Record<string, unknown>>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? ({ ...sec, ...patch } as Section) : sec)));
  }
  function setItem(i: number, key: 'items' | 'testimonials', j: number, patch: Record<string, string>) {
    setSections((s) => s.map((sec, idx) => {
      if (idx !== i) return sec;
      const arr = ((sec as Record<string, unknown>)[key] as Record<string, string>[]).map((it, k) => (k === j ? { ...it, ...patch } : it));
      return { ...sec, [key]: arr } as Section;
    }));
  }

  async function save() { setBusy('save'); const r = await updateLandingSections(landing.id, sections); setBusy(null); setMsg('error' in r && r.error ? 'שגיאה: ' + r.error : '✅ נשמר'); }
  async function chooseStyle(s: UxStyle) { setStyle(s); await setLandingStyle(landing.id, s); }
  async function togglePublish() { const next = !published; setPublished(next); await publishLanding(landing.id, next); }
  async function fill() { if (!brief.trim()) return; setBusy('ai'); const r = await aiFillLanding(landing.id, brief.trim()); setBusy(null); if ('sections' in r && r.sections) setSections(r.sections); setMsg('✅ מולא ע"י AI'); }

  return (
    <main className="max-w-[820px] mx-auto px-5 md:px-10 pt-8 pb-16" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="text-[13px] font-bold text-emerald-600">HELIX OPS · דף נחיתה</div>
          <h1 className="text-[26px] font-black tracking-tight">{landing.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/lp/${landing.slug}`} target="_blank" className="text-[13px] font-bold px-4 py-2 rounded-lg bg-black/5 hover:bg-black/10">👁 תצוגה</a>
          <button onClick={togglePublish} className={`text-[13px] font-bold px-4 py-2 rounded-lg ${published ? 'bg-emerald-600 text-white' : 'bg-black/5'}`}>{published ? '● פורסם' : 'פרסם'}</button>
          <button onClick={save} disabled={busy === 'save'} className="text-[13px] font-bold px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50">{busy === 'save' ? 'שומר…' : 'שמור'}</button>
        </div>
      </div>

      {/* UX style */}
      <div className="rounded-xl border border-black/10 bg-white p-3 mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold">סגנון UX:</span>
        {UX_STYLES.map((u) => (
          <button key={u.id} onClick={() => chooseStyle(u.id)} className={`text-[12px] font-semibold rounded-lg px-3 py-1.5 border ${style === u.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 text-[var(--ink-secondary)]'}`}>{u.name}</button>
        ))}
      </div>

      {/* AI fill */}
      <div className="rounded-xl border border-black/10 bg-white p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input className={inp + ' flex-1 min-w-[220px]'} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="תאר את המוצר/הצעה → AI ימלא את כל הדף" />
        <button onClick={fill} disabled={busy === 'ai'} className="text-[13px] font-bold px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50">{busy === 'ai' ? 'ממלא…' : '✨ מלא ב-AI'}</button>
      </div>

      {/* Section editors */}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div key={i} className="rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-[12px] font-bold text-[var(--ink-secondary)] mb-2">{sectionLabel(s.type)}</div>
            {s.type === 'hero' && <div className="space-y-2"><input className={inp} value={s.headline} onChange={(e) => set(i, { headline: e.target.value })} placeholder="כותרת" /><input className={inp} value={s.sub} onChange={(e) => set(i, { sub: e.target.value })} placeholder="תת-כותרת" /><input className={inp} value={s.cta_label} onChange={(e) => set(i, { cta_label: e.target.value })} placeholder="כפתור" /></div>}
            {s.type === 'benefits' && <div className="space-y-2"><input className={inp} value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="כותרת" />{s.items.map((it, j) => <div key={j} className="flex gap-2"><input className={inp} value={it.title} onChange={(e) => setItem(i, 'items', j, { title: e.target.value })} placeholder="יתרון" /><input className={inp} value={it.desc} onChange={(e) => setItem(i, 'items', j, { desc: e.target.value })} placeholder="תיאור" /></div>)}</div>}
            {s.type === 'video' && <input className={inp} dir="ltr" value={s.video_url} onChange={(e) => set(i, { video_url: e.target.value })} placeholder="קישור וידאו (או צור אווטאר)" />}
            {s.type === 'proof' && <div className="space-y-2"><input className={inp} value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="כותרת" />{s.testimonials.map((q, j) => <div key={j} className="flex gap-2"><input className={inp} value={q.quote} onChange={(e) => setItem(i, 'testimonials', j, { quote: e.target.value })} placeholder="ציטוט" /><input className={inp} value={q.name} onChange={(e) => setItem(i, 'testimonials', j, { name: e.target.value })} placeholder="שם" /></div>)}</div>}
            {s.type === 'faq' && <input className={inp} value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="כותרת" />}
            {s.type === 'cta' && <div className="space-y-2"><input className={inp} value={s.headline} onChange={(e) => set(i, { headline: e.target.value })} placeholder="כותרת" /><input className={inp} value={s.cta_label} onChange={(e) => set(i, { cta_label: e.target.value })} placeholder="כפתור" /></div>}
            {s.type === 'form' && <div className="text-[13px] text-[var(--ink-secondary)]">טופס לידים: {s.fields.map((f) => f.label).join(' · ')}</div>}
          </div>
        ))}
      </div>
      {msg && <p className="mt-4 text-[14px]">{msg}</p>}
    </main>
  );
}

function sectionLabel(t: Section['type']): string {
  return ({ hero: 'Hero (כותרת ראשית)', benefits: 'יתרונות', video: 'וידאו', proof: 'עדויות', faq: 'שאלות נפוצות', cta: 'קריאה לפעולה', form: 'טופס לידים' } as Record<string, string>)[t] ?? t;
}
