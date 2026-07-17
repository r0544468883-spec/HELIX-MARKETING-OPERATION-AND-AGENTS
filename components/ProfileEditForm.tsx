'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Linkedin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { updateProfile } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Props = {
  locale: string;
  t: Dict['profileEdit'];
  initial: {
    name: string;
    roleTitle: string;
    company: string;
    linkedinUrl: string;
    websiteUrl: string;
    bio: string;
    avatarUrl: string | null;
  };
  // פרטים מהחשבון המחובר (OAuth) למשיכה אוטומטית
  fromAuth: { name: string | null; avatar: string | null };
};

export default function ProfileEditForm({ locale, t, initial, fromAuth }: Props) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof typeof s>(k: K, v: (typeof s)[K]) {
    setS((cur) => ({ ...cur, [k]: v }));
  }

  function fillFromAuth() {
    setS((cur) => ({
      ...cur,
      name: cur.name || fromAuth.name || cur.name,
      avatarUrl: cur.avatarUrl || fromAuth.avatar || cur.avatarUrl,
    }));
  }

  async function uploadAvatar(): Promise<string | null> {
    if (!avatarFile) return s.avatarUrl;
    try {
      const supabase = createClient();
      const ext = avatarFile.name.split('.').pop() ?? 'png';
      const path = `avatars/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('product-logos').upload(path, avatarFile);
      if (error) return s.avatarUrl;
      return supabase.storage.from('product-logos').getPublicUrl(path).data.publicUrl;
    } catch {
      return s.avatarUrl;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const avatarUrl = await uploadAvatar();
      const res = await updateProfile({ locale, ...s, avatarUrl });
      if (res?.ok) {
        router.push(`/${locale}/profile/${res.username}`);
        router.refresh();
      }
    });
  }

  const input =
    'w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {(fromAuth.name || fromAuth.avatar) && (
        <button
          type="button"
          onClick={fillFromAuth}
          className="self-start flex items-center gap-2 border border-brand/40 bg-brand/5 hover:bg-brand/10 text-brand rounded-[10px] px-4 py-2 text-[14px] font-bold transition-colors"
        >
          <Linkedin size={15} />
          {t.fillFromAuth}
        </button>
      )}

      <div className="flex items-center gap-4">
        {s.avatarUrl && !avatarFile ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatarUrl} alt="" className="w-16 h-16 rounded-full border border-border object-cover" />
        ) : (
          <span className="w-16 h-16 rounded-full bg-soft border border-border flex items-center justify-center text-xl font-bold">
            {(s.name || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <label className="text-[14px] text-ink-secondary">
          <span className="block font-semibold mb-1">{t.avatar}</span>
          <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[14px]">{t.name}</span>
        <input value={s.name} onChange={(e) => set('name', e.target.value)} dir="auto" className={input} />
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.roleTitle}</span>
          <input value={s.roleTitle} onChange={(e) => set('roleTitle', e.target.value)} dir="auto" className={input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.company}</span>
          <input value={s.company} onChange={(e) => set('company', e.target.value)} dir="auto" className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[14px]">{t.bio}</span>
        <textarea value={s.bio} onChange={(e) => set('bio', e.target.value)} rows={4} dir="auto" className={`${input} resize-y`} />
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.linkedin}</span>
          <input value={s.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." dir="ltr" className={input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.website}</span>
          <input value={s.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} placeholder="https://" dir="ltr" className={input} />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="cta-glow self-start bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-6 py-3 rounded-[10px]"
      >
        {isPending ? t.saving : t.save}
      </button>
    </form>
  );
}
