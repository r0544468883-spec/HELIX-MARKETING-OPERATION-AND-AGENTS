'use client';

// Content Studio — the Content Agent's output: per-channel drafts, editable,
// each with an AI-detection score (human-ness gate), regenerate, and mark-ready.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateDrafts, updateDraft, regenerateDraft } from '@/app/actions-ops';
import CountUp from '@/components/ui/CountUp';

export type Draft = {
  id: string;
  channel: string;
  language: string;
  body: string | null;
  ai_score: number | null;
  status: string;
};

function scoreColor(s: number | null) {
  if (s == null) return 'text-ink-muted';
  return s >= 80 ? 'text-green-400' : s >= 60 ? 'text-yellow-400' : 'text-red-400';
}

export default function ContentStudio({
  requestId,
  drafts: initial,
}: {
  requestId: string;
  drafts: Draft[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(initial);
  const [genPending, startGen] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function generate() {
    setError('');
    startGen(async () => {
      const res = await generateDrafts(requestId);
      if (res?.error) {
        setError(res.error === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'שגיאה ביצירת הטיוטות.');
      } else {
        router.refresh();
      }
    });
  }

  function patch(id: string, p: Partial<Draft>) {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...p } : d)));
  }

  async function save(d: Draft, status: 'draft' | 'ready') {
    setBusyId(d.id);
    await updateDraft(d.id, d.body ?? '', status);
    patch(d.id, { status });
    setBusyId(null);
  }

  async function regen(d: Draft) {
    setBusyId(d.id);
    const res = await regenerateDraft(d.id);
    if (res?.ok) patch(d.id, { body: res.body ?? d.body, ai_score: res.aiScore ?? null, status: 'draft' });
    setBusyId(null);
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="font-bold text-[18px]">סטודיו תוכן</h2>
          <p className="text-ink-secondary text-[14px]">
            הסוכן כותב טיוטה לכל ערוץ, מנקה שגיאות ומדרג עד כמה זה נשמע אנושי. אתם עורכים ומאשרים.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={genPending}
          className="glow bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-5 py-2.5 rounded-[10px] transition-all active:scale-95"
        >
          {genPending ? 'הסוכן כותב…' : drafts.length ? 'צור מחדש הכל' : 'צור טיוטות'}
        </button>
      </div>

      {error && <p className="text-red-400 text-[14px] font-semibold mb-3">{error}</p>}

      {genPending && (
        <div className="flex items-center text-[14px] text-ink-secondary mb-4">
          הסוכן כותב
          <span className="inline-flex items-center ms-2">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center text-ink-secondary text-[15px]">
          עדיין אין טיוטות. לחצו "צור טיוטות" והסוכן יכתוב לכל ערוץ.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {drafts.map((d) => (
            <div key={d.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[15px]">{d.channel}</span>
                <div className="flex items-center gap-3 text-[13px]">
                  <span className={scoreColor(d.ai_score)} title="ציון אנושיות (AI-detection)">
                    אנושי: {d.ai_score != null ? <CountUp value={d.ai_score} /> : '—'}
                  </span>
                  {d.status === 'ready' && <span className="text-green-400 font-semibold">מוכן ✓</span>}
                </div>
              </div>
              <textarea
                rows={6}
                value={d.body ?? ''}
                onChange={(e) => patch(d.id, { body: e.target.value })}
                dir={d.language === 'en' ? 'ltr' : 'auto'}
                className="w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand resize-y"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => save(d, 'ready')}
                  disabled={busyId === d.id}
                  className="bg-brand hover:bg-brand-hover text-bg text-[13px] font-semibold px-3 py-1.5 rounded-[8px] disabled:opacity-50"
                >
                  שמור וסמן מוכן
                </button>
                <button
                  onClick={() => save(d, 'draft')}
                  disabled={busyId === d.id}
                  className="border border-border hover:border-border-strong text-ink text-[13px] font-semibold px-3 py-1.5 rounded-[8px] disabled:opacity-50"
                >
                  שמור
                </button>
                <button
                  onClick={() => regen(d)}
                  disabled={busyId === d.id}
                  className="text-ink-secondary hover:text-ink text-[13px] px-3 py-1.5 disabled:opacity-50"
                >
                  {busyId === d.id ? '…' : '↻ צור מחדש'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
