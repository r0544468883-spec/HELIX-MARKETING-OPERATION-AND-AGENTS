'use client';

// HELIX OPS — global ⌘K / Ctrl+K command bar.
// Additive: mounted once in the root layout, navigates between the app's
// real top-level routes. Uses the shared @helix/motion CommandPalette primitive.
import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CommandPalette, type CommandItem } from '@/lib/motion';
import '@/lib/motion/tokens.css';

// OPS product accent (orange). Global site brand stays emerald; this palette is
// an in-app power-user surface, tinted with the OPS accent.
const ACCENT = '#F97316';

type Loc = 'he' | 'en';

// Real top-level routes under /[locale], labels reused from the feature registry
// where they exist (see lib/features.ts) and folder-derived otherwise.
// [param] pages, API, /lp, and /embed are intentionally excluded.
const ROUTES: { path: string; he: string; en: string }[] = [
  { path: '',             he: 'בית',          en: 'Home' },
  { path: '/requests',    he: 'בקשות',        en: 'Requests' },
  { path: '/requests/new',he: 'בקשה חדשה',    en: 'New request' },
  { path: '/vault',       he: 'כספת',         en: 'Vault' },
  { path: '/brand',       he: 'מותג',         en: 'Brand' },
  { path: '/channels',    he: 'ערוצים',       en: 'Channels' },
  { path: '/attribution', he: 'שיווק',        en: 'Marketing' },
  { path: '/campaigns',   he: 'קמפיינים',     en: 'Campaigns' },
  { path: '/landing',     he: 'דפי נחיתה',    en: 'Landing' },
  { path: '/templates',   he: 'תבניות',       en: 'Templates' },
  { path: '/coach',       he: 'מאמן',         en: 'Coach' },
  { path: '/performance', he: 'פרפורמנס',     en: 'Performance' },
  { path: '/developer',   he: 'Developer API',en: 'Developer API' },
  { path: '/agents',      he: 'סוכנים',       en: 'Agents' },
  { path: '/autonomy',    he: 'אוטונומיה',    en: 'Autonomy' },
  { path: '/radar',       he: 'ראדאר',        en: 'Radar' },
  { path: '/funnels',     he: 'משפכים',       en: 'Funnels' },
  { path: '/engagement',  he: 'מעורבות',      en: 'Engagement' },
  { path: '/media',       he: 'מדיה',         en: 'Media' },
  { path: '/demo',        he: 'דמו',          en: 'Demo' },
  { path: '/login',       he: 'התחברות',      en: 'Log in' },
];

export default function HelixCommandBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // First path segment is the locale; default to 'he'.
  const seg = (pathname || '/').split('/').filter(Boolean)[0];
  const locale: Loc = seg === 'en' ? 'en' : 'he';

  const items: CommandItem[] = useMemo(
    () =>
      ROUTES.map((r) => ({
        id: r.path || 'home',
        title: locale === 'en' ? r.en : r.he,
        subtitle: `/${locale}${r.path}`,
        keywords: `${r.he} ${r.en} ${r.path}`,
        run: () => router.push(`/${locale}${r.path}`),
      })),
    [locale, router]
  );

  return (
    <div dir="rtl" style={{ ['--hm-accent' as any]: ACCENT }}>
      <CommandPalette
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        items={items}
        hotkey
        placeholder={locale === 'en' ? 'Search…' : 'חיפוש…'}
      />
    </div>
  );
}
