import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { locales } from '@/lib/i18n';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/he';

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // לוגין ראשון (או משתמש ותיק לפני v2) → אונבורדינג
    const userId = data?.session?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .maybeSingle();
      if (profile && !profile.onboarding_completed) {
        const seg = next.split('/')[1];
        const locale = locales.includes(seg as (typeof locales)[number]) ? seg : 'he';
        return NextResponse.redirect(`${origin}/${locale}/onboarding`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
