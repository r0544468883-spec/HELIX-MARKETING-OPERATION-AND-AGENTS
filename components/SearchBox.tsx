'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

type Props = {
  locale: string;
  placeholder: string;
  buttonLabel: string;
  initial?: string;
  compact?: boolean;
};

export default function SearchBox({ locale, placeholder, buttonLabel, initial = '', compact }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/${locale}/search?q=${encodeURIComponent(trimmed)}`);
  }

  if (compact) {
    return (
      <form onSubmit={onSubmit} className="relative">
        <Search
          size={16}
          className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          style={{ insetInlineStart: '10px' }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          dir="auto"
          className="w-40 lg:w-52 bg-surface border border-border rounded-full ps-9 pe-3 py-1.5 text-[14px] outline-none focus:border-brand transition-colors"
        />
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        dir="auto"
        autoFocus
        className="flex-1 bg-surface border border-border rounded-[10px] px-4 py-3 text-[16px] outline-none focus:border-brand transition-colors"
      />
      <button
        type="submit"
        className="cta-glow bg-brand hover:bg-brand-hover text-bg font-bold px-6 py-3 rounded-[10px] flex items-center gap-2"
      >
        <Search size={18} />
        <span className="hidden sm:inline">{buttonLabel}</span>
      </button>
    </form>
  );
}
