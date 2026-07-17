'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp } from 'lucide-react';
import { togglePostVote } from '@/app/actions';

type Props = {
  postId: string;
  votes: number;
  hasVoted: boolean;
  isLoggedIn: boolean;
  locale: string;
  path: string;
  size?: 'sm' | 'md';
};

export default function PostVoteButton({
  postId,
  votes,
  hasVoted,
  isLoggedIn,
  locale,
  path,
  size = 'md',
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({ votes, hasVoted });

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push(`/${locale}/login`);
      return;
    }
    startTransition(async () => {
      setOptimistic((cur) => ({
        votes: cur.hasVoted ? cur.votes - 1 : cur.votes + 1,
        hasVoted: !cur.hasVoted,
      }));
      await togglePostVote(postId, path);
    });
  }

  const dims = size === 'sm' ? 'w-11 h-12' : 'w-14 h-14';

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`flex flex-col items-center justify-center ${dims} rounded-2xl border transition-colors shrink-0 ${
        optimistic.hasVoted
          ? 'bg-brand text-bg border-brand'
          : 'bg-surface border-border hover:border-brand text-ink'
      }`}
      aria-pressed={optimistic.hasVoted}
    >
      <ChevronUp size={16} strokeWidth={2.5} />
      <span className="text-[13px] font-bold leading-none mt-0.5">{optimistic.votes}</span>
    </button>
  );
}
