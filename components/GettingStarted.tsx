'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function GettingStarted({
  locale,
  hasBrand,
  hasChannel,
  hasRequest,
}: {
  locale: string;
  hasBrand: boolean;
  hasChannel: boolean;
  hasRequest: boolean;
}) {
  const steps = [
    { done: hasBrand, label: 'הגדירו קווי מותג', href: `/${locale}/brand` },
    { done: hasChannel, label: 'חברו ערוץ הפצה', href: `/${locale}/channels` },
    { done: hasRequest, label: 'צרו בקשת תוכן ראשונה', href: `/${locale}/requests/new` },
  ];
  if (steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-surface border border-border rounded-2xl p-5 mb-8"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-[16px]">
          בואו נתחיל <span className="animate-float">🚀</span>
        </h2>
        <span className="text-[13px] text-ink-muted">{doneCount}/3</span>
      </div>
      <div className="h-1.5 bg-bg rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-brand"
          initial={{ width: 0 }}
          animate={{ width: `${(doneCount / 3) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <Link
            key={i}
            href={s.href}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2 border transition-colors ${
              s.done ? 'border-border text-ink-muted' : 'border-border hover:border-brand'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] ${
                s.done ? 'bg-brand text-bg' : 'border border-border'
              }`}
            >
              {s.done ? '✓' : i + 1}
            </span>
            <span className={s.done ? 'line-through' : ''}>{s.label}</span>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
