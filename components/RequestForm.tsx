'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { createRequest } from '@/app/actions-ops';

const CHANNELS = [
  'וואטסאפ', 'טלגרם', 'מייל', 'פייסבוק', 'אינסטגרם', 'לינקדאין', 'X',
  'Discord', 'Slack', 'Mastodon', 'Bluesky', 'Threads', 'Reddit', 'Dev.to',
  'Medium', 'WordPress', 'Hashnode', 'Pinterest', 'Google My Business',
  'Warpcast', 'Lemmy', 'VK', 'TikTok', 'YouTube', 'Nostr',
];
const PRIORITIES: { key: string; label: string }[] = [
  { key: 'low', label: 'נמוכה' },
  { key: 'normal', label: 'רגילה' },
  { key: 'high', label: 'גבוהה' },
  { key: 'urgent', label: 'דחופה' },
];

const inputCls =
  'w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';
const chip = (active: boolean) =>
  `px-4 py-2 rounded-full border text-[14px] font-semibold transition-colors ${
    active
      ? 'bg-brand text-bg border-brand'
      : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
  }`;

export default function RequestForm({ locale }: { locale: string }) {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const toggle = (c: string) =>
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      // On success the action redirects and does not return here.
      const res = await createRequest({
        locale,
        title,
        brief,
        channels,
        due_date: dueDate || null,
        priority,
      });
      if (res?.error) setError('אירעה שגיאה. נסו שוב.');
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">כותרת הבקשה</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          dir="auto"
          placeholder="למשל: באנר לקמפיין חג"
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">בריף / פרטים</span>
        <textarea
          rows={4}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          dir="auto"
          className={`${inputCls} resize-y`}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">ערוצי הפצה</span>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <motion.button
              key={c}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => toggle(c)}
              className={chip(channels.includes(c))}
            >
              {c}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">עדיפות</span>
        <div className="flex gap-2 flex-wrap">
          {PRIORITIES.map((p) => (
            <motion.button
              key={p.key}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setPriority(p.key)}
              className={chip(priority === p.key)}
            >
              {p.label}
            </motion.button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">תאריך יעד</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
      </label>

      {error && <p className="text-red-400 text-[14px] font-semibold">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !title.trim()}
        className="glow bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold text-[16px] px-6 py-3 rounded-[10px] transition-all self-start active:scale-95"
      >
        {isPending ? 'שולח…' : 'שלח בקשה'}
      </button>
    </form>
  );
}
