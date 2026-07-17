'use client';

import { useState, useTransition } from 'react';
import { createPost } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Props = {
  locale: string;
  t: Dict['community'];
};

export default function PostForm({ locale, t }: Props) {
  const [body, setBody] = useState('');
  const [type, setType] = useState<'build_in_public' | 'show_il'>('build_in_public');
  const [topic, setTopic] = useState('');
  const [isPending, startTransition] = useTransition();

  const topics = [
    { key: '', label: t.topicNone },
    { key: 'Question', label: t.topicQuestion },
    { key: 'Lesson', label: t.topicLesson },
    { key: 'Hiring', label: t.topicHiring },
    { key: 'Revenue', label: t.topicRevenue },
  ];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await createPost({ locale, body, type, topic: topic || null });
      if (res?.ok) {
        setBody('');
        setTopic('');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex gap-2">
        {(['build_in_public', 'show_il'] as const).map((tp) => (
          <button
            key={tp}
            type="button"
            onClick={() => setType(tp)}
            className={`px-4 py-1.5 rounded-full border text-[13px] font-semibold transition-colors ${
              type === tp
                ? 'bg-brand text-bg border-brand'
                : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
            }`}
          >
            {tp === 'build_in_public' ? t.buildInPublic : t.showIl}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {topics.map((tp) => (
          <button
            key={tp.key || 'none'}
            type="button"
            onClick={() => setTopic(tp.key)}
            className={`px-3 py-1 rounded-full border text-[12px] font-semibold transition-colors ${
              topic === tp.key
                ? 'bg-ink text-bg border-ink'
                : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
            }`}
          >
            {tp.label}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.placeholder}
        rows={3}
        dir="auto"
        className="w-full bg-bg border border-border rounded-2xl p-4 text-[15px] outline-none focus:border-brand transition-colors resize-y"
      />
      <button
        type="submit"
        disabled={isPending || !body.trim()}
        className="cta-glow self-start bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-semibold px-5 py-2 rounded-[10px]"
      >
        {isPending ? t.posting : t.post}
      </button>
    </form>
  );
}
