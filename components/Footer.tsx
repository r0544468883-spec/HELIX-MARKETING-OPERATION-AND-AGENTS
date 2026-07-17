import { getDict } from '@/lib/i18n';

const HELIX_URL = 'https://helix-website-nine.vercel.app/';

export default function Footer({ locale }: { locale: string }) {
  const t = getDict(locale);

  return (
    <footer className="border-t border-border mt-20">
      <div className="max-w-[1100px] mx-auto px-5 md:px-10 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-[14px] text-ink-muted">
        <div className="font-bold text-ink">
          HELIX STAGE<span className="text-brand">.</span>
          <span className="font-normal text-ink-muted ms-3">{t.footer.tagline}</span>
        </div>
        <div>
          {t.footer.partOf}{' '}
          <a
            href={HELIX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:text-brand-hover font-semibold"
          >
            HELIX.
          </a>
        </div>
      </div>
    </footer>
  );
}
