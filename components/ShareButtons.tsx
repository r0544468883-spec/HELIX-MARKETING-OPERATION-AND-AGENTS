'use client';

import { useState } from 'react';
import { Link2, Check, Linkedin, Facebook, Mail } from 'lucide-react';

type Props = {
  url: string;
  title: string;
  labels: {
    copy: string;
    copied: string;
    linkedin: string;
    facebook: string;
    gmail: string;
  };
  compact?: boolean;
};

export default function ShareButtons({ url, title, labels, compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard לא זמין — מתעלמים
    }
  }

  function open(href: string) {
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  const encoded = encodeURIComponent(url);
  const btnCls = `flex items-center gap-1.5 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] transition-colors ${
    compact ? 'p-2' : 'px-3 py-2 text-[13px] font-semibold'
  }`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" onClick={copy} className={btnCls} title={labels.copy}>
        {copied ? <Check size={15} className="text-brand" /> : <Link2 size={15} />}
        {!compact && (copied ? labels.copied : labels.copy)}
      </button>
      <button
        type="button"
        onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`)}
        className={btnCls}
        title={labels.linkedin}
      >
        <Linkedin size={15} />
        {!compact && 'LinkedIn'}
      </button>
      <button
        type="button"
        onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`)}
        className={btnCls}
        title={labels.facebook}
      >
        <Facebook size={15} />
        {!compact && 'Facebook'}
      </button>
      <button
        type="button"
        onClick={() =>
          open(
            `https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(title)}&body=${encodeURIComponent(
              `${title}\n${url}`
            )}`
          )
        }
        className={btnCls}
        title={labels.gmail}
      >
        <Mail size={15} />
        {!compact && 'Gmail'}
      </button>
    </div>
  );
}
