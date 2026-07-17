'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { CHANNELS } from '@/lib/attribution';

type Props = {
  baseUrl: string; // {SITE}/{locale}/products/{slug}
  t: {
    linksTitle: string;
    linksHint: string;
    custom: string;
    customPlaceholder: string;
    copy: string;
    copied: string;
  };
};

export default function ChannelLinks({ baseUrl, t }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [custom, setCustom] = useState('');

  function linkFor(ref: string) {
    return `${baseUrl}?ref=${encodeURIComponent(ref)}`;
  }

  async function copy(ref: string) {
    try {
      await navigator.clipboard.writeText(linkFor(ref));
      setCopied(ref);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard לא זמין
    }
  }

  const rows = [...CHANNELS];
  const customKey = custom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <h3 className="font-bold text-[16px]">{t.linksTitle}</h3>
      <p className="text-ink-secondary text-[13px] mt-1 mb-4">{t.linksHint}</p>

      <div className="flex flex-col gap-2">
        {rows.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <span className="w-24 text-[13px] font-semibold text-ink-secondary shrink-0">
              {c.label}
            </span>
            <code
              dir="ltr"
              className="flex-1 min-w-0 truncate bg-bg border border-border rounded-lg px-3 py-1.5 text-[12px] font-mono text-ink-muted"
            >
              {linkFor(c.key)}
            </code>
            <button
              type="button"
              onClick={() => copy(c.key)}
              className="flex items-center gap-1 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors shrink-0"
            >
              {copied === c.key ? <Check size={13} className="text-brand" /> : <Copy size={13} />}
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-border">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={t.customPlaceholder}
            dir="ltr"
            className="w-24 shrink-0 bg-bg border border-border rounded-lg px-2 py-1.5 text-[12px] outline-none focus:border-brand"
          />
          <code
            dir="ltr"
            className="flex-1 min-w-0 truncate bg-bg border border-border rounded-lg px-3 py-1.5 text-[12px] font-mono text-ink-muted"
          >
            {customKey ? linkFor(customKey) : `${baseUrl}?ref=...`}
          </code>
          <button
            type="button"
            disabled={!customKey}
            onClick={() => copy(customKey)}
            className="flex items-center gap-1 border border-border hover:border-brand disabled:opacity-40 text-ink-secondary hover:text-ink rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors shrink-0"
          >
            {copied === customKey && customKey ? (
              <Check size={13} className="text-brand" />
            ) : (
              <Copy size={13} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
