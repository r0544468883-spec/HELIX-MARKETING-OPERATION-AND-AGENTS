'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp } from 'lucide-react';
import { toggleVote } from '@/app/actions';

type Props = {
  launchId: string;
  votes: number;
  hasVoted: boolean;
  isLoggedIn: boolean;
  locale: string;
  path: string;
};

export default function VoteButton({ launchId, votes, hasVoted, isLoggedIn, locale, path }: Props) {
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
      await toggleVote(launchId, path);
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`flex flex-col items-center justify-center w-14 h-16 rounded-2xl border transition-colors shrink-0 ${
        optimistic.hasVoted
          ? 'bg-brand text-bg border-brand'
          : 'bg-surface border-border hover:border-brand text-ink'
      }`}
      aria-pressed={optimistic.hasVoted}
    >
      <ChevronUp size={18} strokeWidth={2.5} />
      <span className="text-[15px] font-bold leading-none mt-1">{optimistic.votes}</span>
    </button>
  );
}
