'use client';

import { useState, useTransition } from 'react';
import { addPostReply } from '@/app/actions';

type Props = {
  postId: string;
  path: string;
  placeholder: string;
  sendLabel: string;
};

export default function PostReplyForm({ postId, path, placeholder, sendLabel }: Props) {
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await addPostReply(postId, body, path);
      if (res?.ok) setBody('');
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        dir="auto"
        className="w-full bg-surface border border-border rounded-2xl p-4 text-[15px] outline-none focus:border-brand transition-colors resize-y"
      />
      <button
        type="submit"
        disabled={isPending || !body.trim()}
        className="cta-glow self-start bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-semibold px-5 py-2 rounded-[10px]"
      >
        {sendLabel}
      </button>
    </form>
  );
}
