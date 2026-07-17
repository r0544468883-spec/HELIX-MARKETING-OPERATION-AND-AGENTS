import { getDict } from '@/lib/i18n';
import AuthButtons from '@/components/AuthButtons';
import MagicLinkForm from '@/components/MagicLinkForm';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = getDict(locale);

  return (
    <div className="max-w-[480px] mx-auto px-5 pt-24 pb-10 flex flex-col items-center text-center">
      <h1 className="font-display text-[clamp(26px,5vw,36px)] font-extrabold tracking-tight">
        {t.auth.title}
      </h1>
      <p className="text-ink-secondary text-[16px] mt-2 mb-10">{t.auth.subtitle}</p>

      <MagicLinkForm
        locale={locale}
        labels={{
          emailPlaceholder: t.auth.emailPlaceholder,
          button: t.auth.magicButton,
          sending: t.auth.magicSending,
          sent: t.auth.magicSent,
          error: t.auth.magicError,
        }}
      />

      <div className="flex items-center gap-3 w-full max-w-xs my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-ink-muted text-[13px]">{t.auth.or}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <AuthButtons
        locale={locale}
        googleLabel={t.auth.google}
        linkedinLabel={t.auth.linkedin}
      />
    </div>
  );
}
