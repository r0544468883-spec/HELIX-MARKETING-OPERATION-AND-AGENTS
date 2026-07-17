'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, ChevronDown, ChevronUp, ExternalLink, MessageCircle, Pencil, Users } from 'lucide-react';
import ShareButtons from './ShareButtons';
import type { Dict } from '@/lib/i18n/he';

type Props = {
  locale: string;
  shareUrl: string;
  labels: Dict['dashboard'];
  shareLabels: Dict['share'];
  statuses: Dict['statuses'];
  publishedDate: string;
  product: {
    id: string;
    name: string;
    slug: string;
    tagline: string;
    logo_url: string | null;
    status: string;
  };
  stats: { votes: number; comments: number };
  waitlistEmails: string[];
};

export default function DashboardProductRow({
  locale,
  shareUrl,
  labels,
  shareLabels,
  statuses,
  publishedDate,
  product,
  stats,
  waitlistEmails,
}: Props) {
  const [showEmails, setShowEmails] = useState(false);

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-start gap-4 flex-wrap">
        {product.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.logo_url}
            alt=""
            className="w-14 h-14 rounded-xl border border-border object-cover shrink-0"
          />
        ) : (
          <span className="w-14 h-14 rounded-xl bg-soft border border-border flex items-center justify-center text-xl font-extrabold text-ink-secondary shrink-0">
            {product.name.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[17px]" dir="auto">
              {product.name}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide border border-border rounded-full px-2 py-0.5 text-ink-secondary">
              {statuses[product.status]}
            </span>
          </div>
          <p className="text-ink-secondary text-[14px] truncate" dir="auto">
            {product.tagline}
          </p>
          <p className="text-ink-muted text-[12px] font-mono mt-1">
            {labels.publishedOn} {publishedDate}
          </p>
        </div>

        <div className="flex items-center gap-4 text-[14px] font-mono">
          <span className="flex items-center gap-1 text-brand font-bold">
            <ChevronUp size={15} strokeWidth={2.5} />
            {stats.votes}
          </span>
          <span className="flex items-center gap-1 text-ink-secondary">
            <MessageCircle size={14} />
            {stats.comments}
          </span>
          <span className="flex items-center gap-1 text-ink-secondary">
            <Users size={14} />
            {waitlistEmails.length}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-4 pt-4 border-t border-border">
        <Link
          href={`/${locale}/dashboard/products/${product.id}`}
          className="flex items-center gap-1.5 border border-brand/40 bg-brand/5 hover:bg-brand/10 text-brand rounded-[10px] px-3 py-2 text-[13px] font-bold transition-colors"
        >
          <BarChart3 size={14} />
          {labels.commandCenter}
        </Link>
        <Link
          href={`/${locale}/dashboard/products/${product.id}/edit`}
          className="flex items-center gap-1.5 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors"
        >
          <Pencil size={14} />
          {labels.edit}
        </Link>
        <Link
          href={`/${locale}/products/${product.slug}`}
          className="flex items-center gap-1.5 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors"
        >
          <ExternalLink size={14} />
          {labels.viewPublic}
        </Link>
        <ShareButtons url={shareUrl} title={`${product.name} — ${product.tagline}`} labels={shareLabels} compact />

        {waitlistEmails.length > 0 && (
          <button
            type="button"
            onClick={() => setShowEmails((v) => !v)}
            className="ms-auto flex items-center gap-1.5 text-brand hover:text-brand-hover text-[13px] font-semibold transition-colors"
          >
            <ChevronDown size={14} className={`transition-transform ${showEmails ? 'rotate-180' : ''}`} />
            {showEmails ? labels.hideEmails : labels.showEmails} ({waitlistEmails.length})
          </button>
        )}
      </div>

      {showEmails && waitlistEmails.length > 0 && (
        <div className="mt-4 bg-soft border border-border rounded-xl p-4">
          <p className="text-[12px] font-semibold text-ink-muted mb-2">{labels.waitlist}</p>
          <ul className="flex flex-col gap-1">
            {waitlistEmails.map((email) => (
              <li key={email} className="text-[13px] font-mono text-ink-secondary" dir="ltr">
                {email}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
