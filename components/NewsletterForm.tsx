'use client';

import { useState, useTransition } from 'react';
import { subscribeNewsletter } from '@/app/actions';

type Props = {
  locale: string;
  placeholder: string;
  buttonLabel: string;
  doneLabel: string;
};

export default function NewsletterForm({ locale, placeholder, buttonLabel, doneLabel }: Props) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <p className="text-brand font-semibold text-[16px]">{doneLabel}</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await subscribeNewsletter(email, locale);
      if (res?.ok) setDone(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className="flex-1 bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors"
      />
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-semibold px-5 py-2.5 rounded-[10px] transition-colors"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
