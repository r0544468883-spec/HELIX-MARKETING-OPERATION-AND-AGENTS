'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

type NavLink = { href: string; label: string };

type Props = {
  links: NavLink[];
  submitHref: string;
  submitLabel: string;
  menuLabel: string;
};

export default function MobileMenu({ links, submitHref, submitLabel, menuLabel }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // נסגר אוטומטית במעבר עמוד
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={menuLabel}
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-border text-ink-secondary hover:text-ink transition-colors"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div className="absolute top-16 inset-x-0 bg-bg/95 backdrop-blur-md border-b border-border shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <nav className="max-w-[1280px] mx-auto px-5 py-4 flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-2.5 px-2 rounded-[10px] text-[16px] text-ink-secondary hover:text-ink hover:bg-soft transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={submitHref}
              className="mt-2 bg-brand hover:bg-brand-hover text-bg text-center font-bold px-4 py-2.5 rounded-[10px] transition-colors"
            >
              {submitLabel}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
