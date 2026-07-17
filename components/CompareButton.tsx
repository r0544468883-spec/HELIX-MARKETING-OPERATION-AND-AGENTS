'use client';

import { useEffect, useState } from 'react';
import { GitCompare, Check } from 'lucide-react';

const KEY = 'hv_compare';

type Item = { slug: string; name: string };

function read(): Item[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export default function CompareButton({
  slug,
  name,
  addLabel,
  addedLabel,
}: {
  slug: string;
  name: string;
  addLabel: string;
  addedLabel: string;
}) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    setInList(read().some((i) => i.slug === slug));
    function onChange() {
      setInList(read().some((i) => i.slug === slug));
    }
    window.addEventListener('hv-compare-change', onChange);
    return () => window.removeEventListener('hv-compare-change', onChange);
  }, [slug]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const cur = read();
    let next: Item[];
    if (cur.some((i) => i.slug === slug)) {
      next = cur.filter((i) => i.slug !== slug);
    } else {
      next = [...cur, { slug, name }].slice(0, 4);
    }
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('hv-compare-change'));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={inList ? addedLabel : addLabel}
      className={`flex items-center justify-center w-9 h-9 rounded-[10px] border transition-colors shrink-0 ${
        inList ? 'border-brand text-brand bg-brand/10' : 'border-border text-ink-muted hover:text-ink hover:border-brand'
      }`}
      aria-pressed={inList}
    >
      {inList ? <Check size={15} /> : <GitCompare size={15} />}
    </button>
  );
}
