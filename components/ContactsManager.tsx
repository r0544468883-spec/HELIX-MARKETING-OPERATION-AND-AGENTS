'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Download, Trash2, Upload, RefreshCw } from 'lucide-react';
import { addContact, deleteContact, importContacts, syncWaitlistToContacts } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Contact = { id: string; email: string; name: string | null; tags: string[]; source: string | null };

type Props = {
  locale: string;
  t: Dict['contacts'];
  contacts: Contact[];
  embedCode: string;
};

function parseCsv(text: string): { email: string; name?: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out: { email: string; name?: string }[] = [];
  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''));
    const email = parts.find((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
    if (email) {
      const name = parts.find((p) => p !== email && p.length > 0);
      out.push({ email, name });
    }
  }
  return out;
}

export default function ContactsManager({ locale, t, contacts, embedCode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const input =
    'bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const res = await addContact({ locale, email, name, tags });
      if (res?.ok) {
        setEmail('');
        setName('');
        setTags('');
        router.refresh();
      }
    });
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ''));
      if (rows.length === 0) return;
      startTransition(async () => {
        const res = await importContacts(locale, rows);
        if (res?.ok) {
          setMsg(`${t.imported}: ${res.count}`);
          router.refresh();
        }
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function onSync() {
    startTransition(async () => {
      const res = await syncWaitlistToContacts(locale);
      if (res?.ok) {
        setMsg(`${t.synced}: ${res.count}`);
        router.refresh();
      }
    });
  }

  function onExport() {
    const csv = ['email,name,tags', ...contacts.map((c) => `${c.email},${c.name ?? ''},"${c.tags.join(';')}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contacts.csv';
    a.click();
  }

  async function copyEmbed() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function onDelete(id: string) {
    startTransition(async () => {
      await deleteContact(id, locale);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* פעולות */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onSync} disabled={isPending} className="flex items-center gap-2 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors">
          <RefreshCw size={15} /> {t.syncWaitlist}
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={isPending} className="flex items-center gap-2 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors">
          <Upload size={15} /> {t.importCsv}
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onImportFile} className="hidden" />
        <button onClick={onExport} className="flex items-center gap-2 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors">
          <Download size={15} /> {t.exportCsv}
        </button>
        {msg && <span className="text-brand text-[13px] font-semibold">{msg}</span>}
      </div>

      {/* טופס מוטמע */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h3 className="font-bold text-[16px]">{t.form}</h3>
        <p className="text-ink-secondary text-[14px] mt-1 mb-3">{t.formHint}</p>
        <button onClick={copyEmbed} className="flex items-center gap-2 border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors mb-3">
          {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
          {copied ? t.copied : t.copyEmbed}
        </button>
        <pre dir="ltr" className="bg-bg border border-border rounded-xl p-3 text-[11px] text-ink-muted overflow-x-auto font-mono">{embedCode}</pre>
      </div>

      {/* הוספה ידנית */}
      <form onSubmit={onAdd} className="flex flex-col sm:flex-row gap-2 items-end">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} dir="ltr" className={`${input} flex-1`} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} dir="auto" className={`${input} flex-1`} />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t.tags} dir="auto" className={`${input} flex-1`} />
        <button type="submit" disabled={isPending || !email.trim()} className="bg-brand hover:bg-brand-hover text-bg font-bold px-5 py-2.5 rounded-[10px] disabled:opacity-50">
          {t.save}
        </button>
      </form>

      {/* רשימה */}
      {contacts.length === 0 ? (
        <p className="text-ink-secondary">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full text-[14px] min-w-[520px]">
            <thead>
              <tr className="bg-soft text-ink-muted text-[12px] uppercase">
                <th className="text-start p-3 font-semibold">{t.email}</th>
                <th className="text-start p-3 font-semibold">{t.name}</th>
                <th className="text-start p-3 font-semibold">{t.tags}</th>
                <th className="text-start p-3 font-semibold">{t.source}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-mono" dir="ltr">{c.email}</td>
                  <td className="p-3" dir="auto">{c.name ?? '—'}</td>
                  <td className="p-3 text-ink-muted">{c.tags.join(', ') || '—'}</td>
                  <td className="p-3 text-ink-muted text-[12px]">{c.source ?? '—'}</td>
                  <td className="p-3">
                    <button onClick={() => onDelete(c.id)} className="text-ink-muted hover:text-red-400 transition-colors" aria-label={t.delete}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
