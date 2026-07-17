'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createProduct, updateProduct, type ProductInput } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Category = { id: number; slug: string; name_he: string; name_en: string };

type Initial = {
  name: string;
  tagline: string;
  description: string;
  website: string;
  status: 'pre_launch' | 'beta' | 'live';
  categoryIds: number[];
  logoUrl: string | null;
  screenshots?: string[];
  alternativeTo?: string[];
  videoUrl?: string;
};

type Props = {
  locale: string;
  categories: Category[];
  t: Dict['submit'];
  statuses: Dict['statuses'];
  mode?: 'create' | 'edit';
  productId?: string;
  initial?: Initial;
};

export default function SubmitForm({
  locale,
  categories,
  t,
  statuses,
  mode = 'create',
  productId,
  initial,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [tagline, setTagline] = useState(initial?.tagline ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [status, setStatus] = useState<'pre_launch' | 'beta' | 'live'>(initial?.status ?? 'live');
  const [selected, setSelected] = useState<number[]>(initial?.categoryIds ?? []);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [existingShots, setExistingShots] = useState<string[]>(initial?.screenshots ?? []);
  const [shotFiles, setShotFiles] = useState<File[]>([]);
  const [altTo, setAltTo] = useState((initial?.alternativeTo ?? []).join(', '));
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? '');
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isEdit = mode === 'edit';

  function toggleCategory(id: number) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((c) => c !== id) : cur.length < 3 ? [...cur, id] : cur
    );
  }

  async function uploadLogo(): Promise<string | null> {
    // בעריכה בלי קובץ חדש — משאירים את הלוגו הקיים
    if (!logoFile) return initial?.logoUrl ?? null;
    try {
      const supabase = createClient();
      const ext = logoFile.name.split('.').pop() ?? 'png';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('product-logos')
        .upload(path, logoFile);
      if (upErr) return initial?.logoUrl ?? null;
      return supabase.storage.from('product-logos').getPublicUrl(path).data.publicUrl;
    } catch {
      return initial?.logoUrl ?? null;
    }
  }

  async function uploadShots(): Promise<string[]> {
    if (shotFiles.length === 0) return existingShots;
    try {
      const supabase = createClient();
      const uploaded: string[] = [];
      for (const file of shotFiles.slice(0, 6)) {
        const ext = file.name.split('.').pop() ?? 'png';
        const p = `shots/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('product-logos').upload(p, file);
        if (!upErr) {
          uploaded.push(supabase.storage.from('product-logos').getPublicUrl(p).data.publicUrl);
        }
      }
      return [...existingShots, ...uploaded].slice(0, 6);
    } catch {
      return existingShots;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);
    startTransition(async () => {
      const logoUrl = await uploadLogo();
      const screenshots = await uploadShots();
      const input: ProductInput = {
        locale,
        name,
        tagline,
        description,
        website,
        status,
        categoryIds: selected,
        logoUrl,
        screenshots,
        videoUrl,
        alternativeTo: altTo
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      // בהצלחה ה-action עושה redirect ולא חוזר לכאן
      const res = isEdit && productId
        ? await updateProduct(productId, input)
        : await createProduct(input);
      if (res?.error) setError(true);
    });
  }

  const inputCls =
    'w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.name}</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={inputCls} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.taglineLabel}</span>
        <input
          required
          maxLength={60}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          dir="auto"
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.description}</span>
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          dir="auto"
          className={`${inputCls} resize-y`}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.website}</span>
        <input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://"
          dir="ltr"
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.video}</span>
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          dir="ltr"
          className={inputCls}
        />
        <span className="text-[13px] text-ink-muted">{t.videoHint}</span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.alternativeTo}</span>
        <input
          value={altTo}
          onChange={(e) => setAltTo(e.target.value)}
          placeholder={t.alternativeToPlaceholder}
          dir="auto"
          className={inputCls}
        />
        <span className="text-[13px] text-ink-muted">{t.alternativeToHint}</span>
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.status}</span>
        <div className="flex gap-2">
          {(['pre_launch', 'beta', 'live'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-full border text-[14px] font-semibold transition-colors ${
                status === s
                  ? 'bg-brand text-bg border-brand'
                  : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
              }`}
            >
              {statuses[s]}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-ink-muted">{t.statusHint}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.categoriesLabel}</span>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCategory(c.id)}
              className={`px-4 py-2 rounded-full border text-[14px] font-semibold transition-colors ${
                selected.includes(c.id)
                  ? 'bg-brand text-bg border-brand'
                  : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
              }`}
            >
              {locale === 'en' ? c.name_en : c.name_he}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.logo}</span>
        {isEdit && initial?.logoUrl && !logoFile && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initial.logoUrl}
            alt=""
            className="w-14 h-14 rounded-xl border border-border object-cover"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          className="text-[14px] text-ink-secondary"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[15px]">{t.screenshots}</span>
        {existingShots.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {existingShots.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-16 rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setExistingShots((cur) => cur.filter((_, j) => j !== i))}
                  className="absolute -top-2 -inset-inline-end-2 bg-surface border border-border rounded-full w-5 h-5 text-[12px] leading-none"
                  style={{ insetInlineEnd: '-8px' }}
                  aria-label="remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setShotFiles(Array.from(e.target.files ?? []))}
          className="text-[14px] text-ink-secondary"
        />
        <span className="text-[13px] text-ink-muted">{t.screenshotsHint}</span>
      </label>

      {error && <p className="text-red-400 text-[14px] font-semibold">{t.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold text-[16px] px-6 py-3 rounded-[10px] transition-colors self-start"
      >
        {isPending ? (isEdit ? t.saving : t.submitting) : isEdit ? t.saveButton : t.submitButton}
      </button>
    </form>
  );
}
