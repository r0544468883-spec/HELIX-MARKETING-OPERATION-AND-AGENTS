'use client';

import { useState, useTransition } from 'react';
import { submitReview } from '@/app/actions';
import StarRating from './StarRating';
import type { Dict } from '@/lib/i18n/he';

type Props = {
  productId: string;
  path: string;
  t: Dict['reviews'];
  initial?: { rating: number; pros: string; cons: string; body: string };
};

export default function ReviewForm({ productId, path, t, initial }: Props) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [pros, setPros] = useState(initial?.pros ?? '');
  const [cons, setCons] = useState(initial?.cons ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) return;
    startTransition(async () => {
      await submitReview({ productId, rating, pros, cons, body, path });
    });
  }

  const inputCls =
    'w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-[15px]">{t.rating}</span>
        <StarRating value={rating} onChange={setRating} size={22} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={pros} onChange={(e) => setPros(e.target.value)} placeholder={t.pros} dir="auto" className={inputCls} />
        <input value={cons} onChange={(e) => setCons(e.target.value)} placeholder={t.cons} dir="auto" className={inputCls} />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.body}
        rows={3}
        dir="auto"
        className={`${inputCls} resize-y`}
      />
      <button
        type="submit"
        disabled={isPending || rating < 1}
        className="cta-glow self-start bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-semibold px-5 py-2.5 rounded-[10px]"
      >
        {isPending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
