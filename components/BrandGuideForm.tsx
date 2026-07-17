'use client';

import { useState, useTransition } from 'react';
import { saveBrandGuide } from '@/app/actions-ops';

type Initial = {
  colors: string[];
  fonts: string[];
  logo_url: string | null;
  disclaimers: string[];
  notes: string | null;
};

const inputCls =
  'w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';

const toList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function BrandGuideForm({ initial }: { initial: Initial | null }) {
  const [colors, setColors] = useState((initial?.colors ?? []).join(', '));
  const [fonts, setFonts] = useState((initial?.fonts ?? []).join(', '));
  const [logo, setLogo] = useState(initial?.logo_url ?? '');
  const [disclaimers, setDisclaimers] = useState((initial?.disclaimers ?? []).join('\n'));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    start(async () => {
      const res = await saveBrandGuide({
        colors: toList(colors),
        fonts: toList(fonts),
        logo_url: logo.trim() || null,
        disclaimers: toList(disclaimers),
        notes,
      });
      setMsg(res?.error ? 'שגיאה בשמירה.' : 'נשמר ✓');
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">צבעי מותג (hex, מופרדים בפסיק)</span>
        <input value={colors} onChange={(e) => setColors(e.target.value)} dir="ltr" placeholder="#10B981, #0F172A" className={inputCls} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">פונטים מותרים</span>
        <input value={fonts} onChange={(e) => setFonts(e.target.value)} dir="auto" placeholder="Heebo, Rubik" className={inputCls} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">קישור ללוגו הרשמי</span>
        <input value={logo} onChange={(e) => setLogo(e.target.value)} dir="ltr" placeholder="https://…" className={inputCls} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">דיסקליימרים חובה (שורה לכל אחד)</span>
        <textarea rows={3} value={disclaimers} onChange={(e) => setDisclaimers(e.target.value)} dir="auto" className={`${inputCls} resize-y`} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">הערות מותג</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" className={`${inputCls} resize-y`} />
      </label>

      {msg && <p className="text-[14px] font-semibold text-ink-secondary">{msg}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold text-[16px] px-6 py-3 rounded-[10px] transition-colors self-start"
      >
        {pending ? 'שומר…' : 'שמור קווי מותג'}
      </button>
    </form>
  );
}
