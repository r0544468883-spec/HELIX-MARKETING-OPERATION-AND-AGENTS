'use client';

import { Star } from 'lucide-react';

type Props = {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
};

export default function StarRating({ value, onChange, size = 18 }: Props) {
  const interactive = Boolean(onChange);
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            size={size}
            className={filled ? 'text-brand' : 'text-ink-soft'}
            fill={filled ? 'currentColor' : 'none'}
            strokeWidth={filled ? 0 : 1.5}
          />
        );
        return interactive ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="p-0.5 hover:scale-110 transition-transform"
            aria-label={`${n}`}
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
