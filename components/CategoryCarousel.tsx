'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import type { Top5Item } from '@/lib/top5';

type Props = {
  locale: string;
  rtl: boolean;
  items: Top5Item[];
  statuses: Record<string, string>;
  prevLabel: string;
  nextLabel: string;
};

function getPosition(index: number, current: number, total: number): string {
  if (total === 1) return 'cc-center';
  const diff = (index - current + total) % total;
  if (diff === 0) return 'cc-center';
  if (diff === 1) return 'cc-right';
  if (diff === total - 1) return 'cc-left';
  if (diff === 2 && total > 3) return 'cc-far-right';
  if (diff === total - 2 && total > 4) return 'cc-far-left';
  return 'cc-hidden';
}

export default function CategoryCarousel({
  locale,
  rtl,
  items,
  statuses,
  prevLabel,
  nextLabel,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const n = items.length;

  const go = useCallback(
    (dir: 1 | -1) => {
      setCurrent((c) => (c + dir + n) % n);
    },
    [n]
  );

  // רוטציה אוטומטית כל 6 שניות, נעצרת ב-hover ומכבדת reduced motion
  useEffect(() => {
    if (n < 2 || paused) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = setInterval(() => setCurrent((c) => (c + 1) % n), 6000);
    return () => clearInterval(id);
  }, [n, paused]);

  // גלגלת: רק תנועה אופקית (טראקפאד), בלי לחסום גלילה אנכית של העמוד
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || n < 2) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = Date.now();
      if (now - last < 400) return;
      last = now;
      setCurrent((c) => (c + (e.deltaX > 0 ? 1 : -1) + n) % n);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [n]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (n < 2) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(rtl ? -1 : 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(rtl ? 1 : -1);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || n < 2) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 20) go(diff > 0 ? -1 : 1);
  }

  return (
    <div dir="ltr">
      <div
        ref={wrapRef}
        className="cc-wrap"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        onKeyDown={onKeyDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {items.map((item, i) => {
          const pos = getPosition(i, current, n);
          const isCenter = pos === 'cc-center';
          const inner = (
            <div dir={rtl ? 'rtl' : 'ltr'}>
              <div className="flex items-center gap-3 mb-3">
                {item.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.logoUrl}
                    alt=""
                    className="w-12 h-12 rounded-xl border border-border object-cover shrink-0"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-xl bg-soft border border-border flex items-center justify-center text-lg font-extrabold text-ink-secondary shrink-0">
                    {item.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-extrabold text-[17px] text-ink truncate font-display" dir="auto">
                    {item.name}
                  </div>
                  {item.status !== 'live' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-brand border border-brand/25 rounded-full px-2 py-0.5">
                      {statuses[item.status]}
                    </span>
                  )}
                </div>
              </div>
              <p
                className="text-ink-secondary text-[14px] leading-relaxed line-clamp-2 min-h-[44px] mb-3"
                dir="auto"
              >
                {item.tagline}
              </p>
              <div className="flex items-center gap-1.5 text-brand font-mono text-[14px] font-bold">
                <ChevronUp size={15} strokeWidth={2.5} />
                {item.votes}
              </div>
            </div>
          );

          return isCenter ? (
            <Link
              key={item.launchId}
              href={`/${locale}/products/${item.slug}`}
              className={`cc-card ${pos}`}
              aria-current="true"
            >
              {inner}
            </Link>
          ) : (
            <div
              key={item.launchId}
              className={`cc-card ${pos}`}
              onClick={() => setCurrent(i)}
              aria-hidden="true"
            >
              {inner}
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="cc-controls">
          <button type="button" className="cc-btn" onClick={() => go(rtl ? 1 : -1)} aria-label={prevLabel}>
            <ChevronLeft size={18} />
          </button>
          <div className="cc-dots">
            {items.map((item, i) => (
              <button
                key={item.launchId}
                type="button"
                className={`cc-dot ${i === current ? 'active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`${i + 1}`}
              />
            ))}
          </div>
          <button type="button" className="cc-btn" onClick={() => go(rtl ? -1 : 1)} aria-label={nextLabel}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
