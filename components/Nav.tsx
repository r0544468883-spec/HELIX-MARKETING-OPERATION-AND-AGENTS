import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions-ops';
import { getEnabledFeatures } from '@/lib/features/server';
import type { Locale } from '@/lib/features';
import NavLinks from './NavLinks';

export default async function Nav({ locale }: { locale: string }) {
  let signedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
  } catch {
    // עדיין אין חיבור ל-Supabase — הניווט עובד גם בלי
  }

  const L = (p: string) => `/${locale}${p}`;
  const loc = (locale === 'en' ? 'en' : 'he') as Locale;
  const t =
    locale === 'en'
      ? { newRequest: 'New request', login: 'Log in', logout: 'Log out' }
      : { newRequest: 'בקשה חדשה', login: 'התחברות', logout: 'התנתקות' };

  // Nav links are the workspace's ENABLED features, in registry order.
  const features = await getEnabledFeatures();
  const navItems = features.map((f) => ({ href: L(f.path), label: f.label[loc], hideSm: f.hideSm }));
  // Logo + fallbacks point at the first enabled feature so a lean workspace never
  // links to a disabled route. The "new request" CTA only shows if requests is on.
  const homeHref = navItems[0]?.href ?? L('/requests');
  const hasRequests = features.some((f) => f.id === 'requests');

  return (
    <header className="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-border">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10 h-16 flex items-center justify-between gap-4">
        <Link
          href={homeHref}
          className="nav-logo font-display font-black text-lg tracking-tight shrink-0"
        >
          HELIX OPS<span className="dot text-brand">.</span>
        </Link>

        <NavLinks items={navItems} />

        <div className="flex items-center gap-3">
          {signedIn ? (
            <>
              {hasRequests && (
                <Link
                  href={L('/requests/new')}
                  className="glow bg-brand hover:bg-brand-hover text-bg text-[15px] font-bold px-4 py-2 rounded-[10px] transition-all active:scale-95"
                >
                  + {t.newRequest}
                </Link>
              )}
              <form action={signOut.bind(null, locale)}>
                <button
                  type="submit"
                  className="text-[14px] text-ink-secondary hover:text-ink transition-colors"
                >
                  {t.logout}
                </button>
              </form>
            </>
          ) : (
            <Link
              href={L('/login')}
              className="text-[15px] text-ink-secondary hover:text-ink transition-colors"
            >
              {t.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
