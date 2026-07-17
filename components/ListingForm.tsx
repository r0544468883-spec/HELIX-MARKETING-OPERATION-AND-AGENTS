'use client';

import { useState, useTransition } from 'react';
import { createListing } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Product = { id: string; name: string };

type Props = {
  locale: string;
  products: Product[];
  t: Dict['listing'];
  boardT: Dict['board'];
};

export default function ListingForm({ locale, products, t, boardT }: Props) {
  const [type, setType] = useState<'hiring' | 'open_to_work' | 'collab'>('hiring');
  const [roleTitle, setRoleTitle] = useState('');
  const [body, setBody] = useState('');
  const [productId, setProductId] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await createListing({ locale, type, roleTitle, body, productId: productId || null, contactEmail });
      if (res?.ok) {
        setRoleTitle('');
        setBody('');
        setProductId('');
        setContactEmail('');
      }
    });
  }

  const input =
    'w-full bg-bg border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';
  const types: { key: typeof type; label: string }[] = [
    { key: 'hiring', label: boardT.hiring },
    { key: 'open_to_work', label: boardT.openToWork },
    { key: 'collab', label: boardT.collab },
  ];

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {types.map((tp) => (
          <button
            key={tp.key}
            type="button"
            onClick={() => setType(tp.key)}
            className={`px-4 py-1.5 rounded-full border text-[13px] font-semibold transition-colors ${
              type === tp.key
                ? 'bg-brand text-bg border-brand'
                : 'bg-surface border-border text-ink-secondary hover:border-border-strong'
            }`}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {type !== 'collab' && (
        <input
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder={t.roleTitlePlaceholder}
          dir="auto"
          className={input}
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.bodyPlaceholder}
        rows={3}
        dir="auto"
        className={`${input} resize-y`}
      />

      {products.length > 0 && (
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={input} dir="auto">
          <option value="">{t.product}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <input
        type="email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        placeholder={t.contactEmail}
        dir="ltr"
        className={input}
      />

      <button
        type="submit"
        disabled={isPending || !body.trim()}
        className="cta-glow self-start bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-5 py-2.5 rounded-[10px]"
      >
        {isPending ? t.submitting : t.submit}
      </button>
    </form>
  );
}
