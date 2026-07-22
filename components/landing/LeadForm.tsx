'use client';

import { useState } from 'react';
import type { FormField } from '@/lib/landing/types';

// Lead capture block — posts to /api/lp/[slug]/lead, which stores the lead and
// feeds attribution (mkt_visitors). The conversion event that closes the ad→LP loop.
export default function LeadForm({ slug, title, fields, submitLabel, accent }: {
  slug: string; title: string; fields: FormField[]; submitLabel: string; accent: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch(`/api/lp/${slug}/lead`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: values, utm: Object.fromEntries(new URLSearchParams(location.search)) }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch { setState('error'); }
  }

  if (state === 'done') return <div className="max-w-md mx-auto text-center py-8 text-[18px] font-bold" style={{ color: accent }}>תודה! נחזור אליכם בהקדם 🙌</div>;

  return (
    <form onSubmit={submit} className="max-w-md mx-auto w-full space-y-3" dir="rtl">
      <h3 className="text-[22px] font-black text-center mb-2">{title}</h3>
      {fields.map((f) => (
        <input key={f.name} type={f.type} required placeholder={f.label}
          className="w-full rounded-xl border border-black/15 px-4 py-3 text-[16px] outline-none focus:border-current"
          value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
      ))}
      <button disabled={state === 'busy'} className="w-full rounded-xl px-6 py-3 text-[16px] font-bold text-white disabled:opacity-50" style={{ background: accent }}>
        {state === 'busy' ? 'שולח…' : submitLabel}
      </button>
      {state === 'error' && <p className="text-[14px] text-red-600 text-center">שגיאה בשליחה, נסו שוב.</p>}
    </form>
  );
}
