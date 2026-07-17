'use client';

import { useState } from 'react';
import { Check, Code2 } from 'lucide-react';
import type { Dict } from '@/lib/i18n/he';

type Props = {
  siteUrl: string;
  locale: string;
  slug: string;
  t: Dict['badge'];
};

export default function BadgeEmbed({ siteUrl, locale, slug, t }: Props) {
  const [copied, setCopied] = useState(false);

  const productUrl = `${siteUrl}/${locale}/products/${slug}`;
  const badgeUrl = `${siteUrl}/api/badge?slug=${encodeURIComponent(slug)}`;
  const snippet = `<a href="${productUrl}" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="Featured on HELIX STAGE" width="220" height="54" /></a>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard לא זמין
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <h3 className="font-bold text-[16px] mb-1">{t.title}</h3>
      <p className="text-ink-secondary text-[14px] mb-4">{t.text}</p>

      <div className="flex items-center gap-4 flex-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badgeUrl} alt="HELIX STAGE badge" width={220} height={54} />
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-2 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors"
        >
          {copied ? <Check size={15} className="text-brand" /> : <Code2 size={15} />}
          {copied ? t.copied : t.copy}
        </button>
      </div>

      <pre
        dir="ltr"
        className="mt-4 bg-bg border border-border rounded-xl p-3 text-[12px] text-ink-muted overflow-x-auto font-mono"
      >
        {snippet}
      </pre>
    </div>
  );
}
