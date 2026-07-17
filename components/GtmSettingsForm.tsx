'use client';

import { useState, useTransition } from 'react';
import { updateGtm } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Props = {
  locale: string;
  productId: string;
  slug: string;
  siteUrl: string;
  t: Dict['gtm'];
  initial: {
    betaEnabled: boolean;
    betaWhatsappUrl: string;
    betaNote: string;
    landingEnabled: boolean;
    landingHeadline: string;
    landingSubheadline: string;
    landingCta: string;
  };
};

export default function GtmSettingsForm({ locale, productId, slug, siteUrl, t, initial }: Props) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof typeof s>(k: K, v: (typeof s)[K]) {
    setS((cur) => ({ ...cur, [k]: v }));
    setSaved(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateGtm(productId, { locale, ...s });
      if (res?.ok) setSaved(true);
    });
  }

  const input =
    'w-full bg-bg border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';
  const landingUrl = `${siteUrl}/${locale}/early/${slug}`;

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-6">
      <h3 className="font-bold text-[17px]">{t.settingsTitle}</h3>

      {/* בטא */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 font-semibold text-[15px]">
          <input
            type="checkbox"
            checked={s.betaEnabled}
            onChange={(e) => set('betaEnabled', e.target.checked)}
            className="w-4 h-4 accent-[#10B981]"
          />
          {t.betaSection}
        </label>
        {s.betaEnabled && (
          <div className="flex flex-col gap-2 ps-6">
            <input
              value={s.betaWhatsappUrl}
              onChange={(e) => set('betaWhatsappUrl', e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              dir="ltr"
              className={input}
            />
            <input
              value={s.betaNote}
              onChange={(e) => set('betaNote', e.target.value)}
              placeholder={t.betaNote}
              dir="auto"
              className={input}
            />
          </div>
        )}
      </div>

      {/* דף נחיתה */}
      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <label className="flex items-center gap-2 font-semibold text-[15px]">
          <input
            type="checkbox"
            checked={s.landingEnabled}
            onChange={(e) => set('landingEnabled', e.target.checked)}
            className="w-4 h-4 accent-[#10B981]"
          />
          {t.landingSection}
        </label>
        {s.landingEnabled && (
          <div className="flex flex-col gap-2 ps-6">
            <input
              value={s.landingHeadline}
              onChange={(e) => set('landingHeadline', e.target.value)}
              placeholder={t.landingHeadline}
              dir="auto"
              className={input}
            />
            <input
              value={s.landingSubheadline}
              onChange={(e) => set('landingSubheadline', e.target.value)}
              placeholder={t.landingSubheadline}
              dir="auto"
              className={input}
            />
            <input
              value={s.landingCta}
              onChange={(e) => set('landingCta', e.target.value)}
              placeholder={t.landingCta}
              dir="auto"
              className={input}
            />
            <a
              href={landingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:text-brand-hover text-[13px] font-semibold font-mono"
              dir="ltr"
            >
              {landingUrl} ↗
            </a>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="cta-glow self-start bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-6 py-2.5 rounded-[10px]"
      >
        {isPending ? t.saving : saved ? t.saved : t.save}
      </button>
    </form>
  );
}
