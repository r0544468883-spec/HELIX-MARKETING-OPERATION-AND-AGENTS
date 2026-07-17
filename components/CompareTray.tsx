'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitCompare, X } from 'lucide-react';

const KEY = 'hv_compare';

type Item = { slug: string; name: string };

export default function CompareTray({
  locale,
  compareLabel,
  clearLabel,
}: {
  locale: string;
  compareLabel: string;
  clearLabel: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    function refresh() {
      try {
        setItems(JSON.parse(localStorage.getItem(KEY) || '[]'));
      } catch {
        setItems([]);
      }
    }
    refresh();
    window.addEventListener('hv-compare-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('hv-compare-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (items.length === 0) return null;

  function clear() {
    localStorage.setItem(KEY, '[]');
    window.dispatchEvent(new Event('hv-compare-change'));
  }

  function go() {
    const ids = items.map((i) => i.slug).join(',');
    router.push(`/${locale}/compare?ids=${encodeURIComponent(ids)}`);
  }

  return (
    <div className="fixed bottom-5 inset-inline-0 z-[90] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 bg-surface/95 backdrop-blur-md border border-border-strong rounded-full ps-5 pe-2 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <GitCompare size={16} className="text-brand" />
        <span className="text-[14px] font-semibold">{items.length}</span>
        <button
          type="button"
          onClick={clear}
          className="text-ink-muted hover:text-ink p-1"
          aria-label={clearLabel}
        >
          <X size={15} />
        </button>
        <button
          type="button"
          onClick={go}
          disabled={items.length < 2}
          className="bg-brand hover:bg-brand-hover disabled:opacity-40 text-bg font-bold px-4 py-1.5 rounded-full text-[14px]"
        >
          {compareLabel}
        </button>
      </div>
    </div>
  );
}
