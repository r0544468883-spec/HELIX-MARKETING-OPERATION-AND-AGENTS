import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/actions-ops';
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
  const t =
    locale === 'en'
      ? { requests: 'Requests', vault: 'Vault', brand: 'Brand', channels: 'Channels', marketing: 'Marketing', campaigns: 'Campaigns', landing: 'Landing', newRequest: 'New request', login: 'Log in', logout: 'Log out' }
      : { requests: 'בקשות', vault: 'כספת', brand: 'מותג', channels: 'ערוצים', marketing: 'שיווק', campaigns: 'קמפיינים', landing: 'דפי נחיתה', newRequest: 'בקשה חדשה', login: 'התחברות', logout: 'התנתקות' };

  return (
    <header className="sticky top-0 z-50 bg-bg/85 backdrop-blur-md border-b border-border">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10 h-16 flex items-center justify-between gap-4">
        <Link
          href={L('/requests')}
          className="nav-logo font-display font-black text-lg tracking-tight shrink-0"
        >
          HELIX OPS<span className="dot text-brand">.</span>
        </Link>

        <NavLinks
          items={[
            { href: L('/requests'), label: t.requests },
            { href: L('/vault'), label: t.vault, hideSm: true },
            { href: L('/brand'), label: t.brand, hideSm: true },
            { href: L('/channels'), label: t.channels, hideSm: true },
            { href: L('/attribution'), label: t.marketing, hideSm: true },
            { href: L('/campaigns'), label: t.campaigns, hideSm: true },
            { href: L('/landing'), label: t.landing, hideSm: true },
          ]}
        />

        <div className="flex items-center gap-3">
          {signedIn ? (
            <>
              <Link
                href={L('/requests/new')}
                className="glow bg-brand hover:bg-brand-hover text-bg text-[15px] font-bold px-4 py-2 rounded-[10px] transition-all active:scale-95"
              >
                + {t.newRequest}
              </Link>
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
