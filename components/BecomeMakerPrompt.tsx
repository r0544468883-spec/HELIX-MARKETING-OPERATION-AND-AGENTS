'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket } from 'lucide-react';
import { becomeMaker } from '@/app/actions';

type Props = {
  path: string;
  title: string;
  text: string;
  button: string;
};

export default function BecomeMakerPrompt({ path, title, text, button }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await becomeMaker(path);
      router.refresh();
    });
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-10 text-center max-w-lg mx-auto">
      <Rocket size={32} className="text-brand mx-auto mb-4" strokeWidth={1.5} />
      <h2 className="font-display text-[22px] font-extrabold">{title}</h2>
      <p className="text-ink-secondary text-[15px] mt-2 mb-6">{text}</p>
      <button
        onClick={onClick}
        disabled={isPending}
        className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-6 py-3 rounded-[10px] transition-colors"
      >
        {button}
      </button>
    </div>
  );
}
