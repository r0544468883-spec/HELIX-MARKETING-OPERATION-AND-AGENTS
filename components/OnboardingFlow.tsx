'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Rocket } from 'lucide-react';
import { completeOnboarding } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Category = { id: number; slug: string; name_he: string; name_en: string };

type Props = {
  locale: string;
  categories: Category[];
  t: Dict['onboarding'];
  initialName: string;
};

export default function OnboardingFlow({ locale, categories, t, initialName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<'consumer' | 'maker' | null>(null);
  const [name, setName] = useState(initialName);
  const [roleTitle, setRoleTitle] = useState('');
  const [company, setCompany] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [interests, setInterests] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();

  function toggleInterest(id: number) {
    setInterests((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  function finish(destination: 'home' | 'submit' | 'dashboard') {
    if (!userType) return;
    startTransition(async () => {
      const res = await completeOnboarding({
        locale,
        userType,
        name,
        roleTitle,
        company,
        linkedinUrl,
        interests,
      });
      if (res?.ok) {
        const target =
          destination === 'submit'
            ? `/${locale}/submit`
            : destination === 'dashboard'
              ? `/${locale}/dashboard`
              : `/${locale}`;
        router.push(target);
        router.refresh();
      }
    });
  }

  const inputCls =
    'w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';

  return (
    <div className="flex flex-col gap-8">
      {/* מחוון שלבים */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all ${
              s === step ? 'bg-brand w-8' : s < step ? 'bg-brand/40 w-5' : 'bg-soft w-5'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="font-display text-[22px] font-extrabold mb-6">{t.step1Title}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setUserType('consumer')}
              className={`text-start rounded-2xl border p-6 transition-colors ${
                userType === 'consumer'
                  ? 'border-brand bg-brand/5'
                  : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              <Compass size={26} className="text-brand mb-3" strokeWidth={1.5} />
              <div className="font-bold text-[17px]">{t.consumerTitle}</div>
              <p className="text-ink-secondary text-[14px] mt-1">{t.consumerText}</p>
            </button>
            <button
              type="button"
              onClick={() => setUserType('maker')}
              className={`text-start rounded-2xl border p-6 transition-colors ${
                userType === 'maker'
                  ? 'border-brand bg-brand/5'
                  : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              <Rocket size={26} className="text-brand mb-3" strokeWidth={1.5} />
              <div className="font-bold text-[17px]">{t.makerTitle}</div>
              <p className="text-ink-secondary text-[14px] mt-1">{t.makerText}</p>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <h2 className="font-display text-[22px] font-extrabold">{t.step2Title}</h2>
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-[14px]">{t.nameLabel}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={inputCls} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-[14px]">{t.roleTitleLabel}</span>
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} dir="auto" className={inputCls} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-[14px]">{t.companyLabel}</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} dir="auto" className={inputCls} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-semibold text-[14px]">{t.linkedinLabel}</span>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              dir="ltr"
              className={inputCls}
            />
          </label>
        </div>
      )}

      {step === 3 && userType === 'consumer' && (
        <div>
          <h2 className="font-display text-[22px] font-extrabold">{t.step3ConsumerTitle}</h2>
          <p className="text-ink-secondary text-[14px] mt-1 mb-5">{t.step3ConsumerHint}</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleInterest(c.id)}
                className={`px-4 py-2 rounded-full border text-[14px] font-semibold transition-colors ${
                  interests.includes(c.id)
                    ? 'bg-brand text-bg border-brand'
                    : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
                }`}
              >
                {locale === 'en' ? c.name_en : c.name_he}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && userType === 'maker' && (
        <div>
          <h2 className="font-display text-[22px] font-extrabold">{t.step3MakerTitle}</h2>
          <p className="text-ink-secondary text-[14px] mt-1 mb-6">{t.step3MakerText}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() => finish('submit')}
              className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-6 py-3 rounded-[10px] transition-colors"
            >
              {t.submitFirst}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => finish('dashboard')}
              className="border border-border-strong hover:border-brand text-ink font-semibold px-6 py-3 rounded-[10px] transition-colors"
            >
              {t.goDashboard}
            </button>
          </div>
        </div>
      )}

      {/* ניווט בין שלבים */}
      <div className="flex items-center gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="text-ink-secondary hover:text-ink text-[14px] font-semibold transition-colors"
          >
            {t.back}
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            disabled={step === 1 && !userType}
            onClick={() => setStep((s) => s + 1)}
            className="ms-auto bg-brand hover:bg-brand-hover disabled:opacity-40 text-bg font-bold px-6 py-2.5 rounded-[10px] transition-colors"
          >
            {t.continue}
          </button>
        )}
        {step === 3 && userType === 'consumer' && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => finish('home')}
            className="ms-auto bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-6 py-2.5 rounded-[10px] transition-colors"
          >
            {t.finish}
          </button>
        )}
      </div>
    </div>
  );
}
