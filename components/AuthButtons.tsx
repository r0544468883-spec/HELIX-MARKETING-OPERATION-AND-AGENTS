'use client';

import { createClient } from '@/lib/supabase/client';

type Props = {
  locale: string;
  googleLabel: string;
  linkedinLabel: string;
};

export default function AuthButtons({ locale, googleLabel, linkedinLabel }: Props) {
  async function signIn(provider: 'google' | 'linkedin_oidc') {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/${locale}`,
      },
    });
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <button
        onClick={() => signIn('google')}
        className="bg-surface border border-border hover:border-brand text-ink font-semibold px-5 py-3 rounded-[10px] transition-colors"
      >
        {googleLabel}
      </button>
      <button
        onClick={() => signIn('linkedin_oidc')}
        className="bg-surface border border-border hover:border-brand text-ink font-semibold px-5 py-3 rounded-[10px] transition-colors"
      >
        {linkedinLabel}
      </button>
    </div>
  );
}
