'use client';

import { useState, useTransition } from 'react';
import { joinWaitlist } from '@/app/actions';

type Props = {
  productId: string;
  placeholder: string;
  buttonLabel: string;
  doneLabel: string;
};

export default function WaitlistForm({ productId, placeholder, buttonLabel, doneLabel }: Props) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <p className="text-brand font-semibold text-[15px]">{doneLabel}</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await joinWaitlist(productId, email);
      if (res?.ok) setDone(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
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
