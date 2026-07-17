import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import VoteButton from './VoteButton';
import CompareButton from './CompareButton';
import { getDict, formatDate } from '@/lib/i18n';

type Props = {
  locale: string;
  path: string;
  isLoggedIn: boolean;
  hasVoted: boolean;
  launch: {
    id: string;
    votes_count: number;
    comments_count: number;
    launch_date?: string;
  };
  product: {
    name: string;
    slug: string;
    tagline: string;
    logo_url: string | null;
    status: string;
  };
};

export default function LaunchCard({ locale, path, isLoggedIn, hasVoted, launch, product }: Props) {
  const t = getDict(locale);

  return (
    <div className="card-hover flex items-center gap-4 bg-surface border border-border rounded-2xl p-4">
      <Link
        href={`/${locale}/products/${product.slug}`}
        className="flex items-center gap-4 flex-1 min-w-0"
      >
        {product.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.logo_url}
            alt={product.name}
            className="w-14 h-14 rounded-xl border border-border object-cover shrink-0"
          />
        ) : (
          <span className="w-14 h-14 rounded-xl bg-soft border border-border flex items-center justify-center text-xl font-extrabold text-ink-secondary shrink-0">
            {product.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[17px]" dir="auto">
              {product.name}
            </span>
            {product.status !== 'live' && (
              <span className="text-[11px] font-semibold uppercase tracking-wide border border-border rounded-full px-2 py-0.5 text-ink-secondary">
                {t.statuses[product.status]}
              </span>
            )}
          </div>
          <p className="text-ink-secondary text-[15px] truncate" dir="auto">
            {product.tagline}
          </p>
          <div className="flex items-center gap-3 text-ink-muted text-[13px] mt-1">
            <span className="flex items-center gap-1">
              <MessageCircle size={13} />
              {launch.comments_count}
            </span>
            {launch.launch_date && (
              <span className="font-mono text-[12px]">{formatDate(launch.launch_date, locale)}</span>
            )}
          </div>
        </div>
      </Link>
      <CompareButton
        slug={product.slug}
        name={product.name}
        addLabel={t.compare.add}
        addedLabel={t.compare.added}
      />
      <VoteButton
        launchId={launch.id}
        votes={launch.votes_count}
        hasVoted={hasVoted}
        isLoggedIn={isLoggedIn}
        locale={locale}
        path={path}
      />
    </div>
  );
}
