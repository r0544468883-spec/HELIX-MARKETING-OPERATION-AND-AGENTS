'use client';

import { useState, useTransition } from 'react';
import { Mail, X } from 'lucide-react';
import { contactListing } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Props = {
  listingId: string;
  isLoggedIn: boolean;
  locale: string;
  t: Dict['listing'];
};

export default function ContactListingButton({ listingId, isLoggedIn, locale, t }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <a
        href={`/${locale}/login`}
        className="flex items-center gap-1.5 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors"
      >
        <Mail size={14} />
        {t.contact}
      </a>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    startTransition(async () => {
      const res = await contactListing(listingId, name, message);
      if (res?.ok) setDone(true);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 border border-brand/40 bg-brand/5 hover:bg-brand/10 text-brand rounded-[10px] px-3 py-2 text-[13px] font-bold transition-colors"
      >
        <Mail size={14} />
        {t.contact}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl p-6 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 inset-inline-end-4 text-ink-muted hover:text-ink"
              style={{ insetInlineEnd: '16px' }}
              aria-label="close"
            >
              <X size={18} />
            </button>
            <h3 className="font-bold text-[18px] mb-4">{t.contactVia}</h3>
            {done ? (
              <p className="text-brand font-semibold text-[15px]">{t.sent}</p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.yourName}
                  dir="auto"
                  className="w-full bg-bg border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand"
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t.yourMessage}
                  rows={4}
                  dir="auto"
                  className="w-full bg-bg border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand resize-y"
                />
                <button
                  type="submit"
                  disabled={isPending || !message.trim()}
                  className="cta-glow self-start bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-5 py-2.5 rounded-[10px]"
                >
                  {isPending ? t.sending : t.send}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
