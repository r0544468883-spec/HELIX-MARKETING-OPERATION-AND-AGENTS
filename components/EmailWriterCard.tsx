'use client';

// Email Writer/Rewriter — a content tool in the Performance Tools grid. Writes an email from
// a brief, or rewrites an existing one, in Hebrew or English. Falls back to the dev-only
// /api/content-tool route when there's no logged-in workspace (localhost).

import { useState, useTransition } from 'react';
import { Mail, Copy, Check, Loader2 } from 'lucide-react';
import { emailAction } from '@/app/actions-performance';

type EmailResult = { subject: string; body: string };

const CARD = 'border border-border rounded-[14px] p-5 bg-soft/30';
const INPUT = 'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand';
const BTN = 'glow inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] disabled:opacity-60 active:scale-95 transition-all';
const GHOST = 'inline-flex items-center gap-2 border border-border hover:bg-soft text-ink-secondary hover:text-ink px-3 py-1.5 rounded-[10px] text-[13px] transition-colors';
const PILL = (on: boolean) =>
  `px-3 py-1.5 rounded-[10px] text-[13px] border transition-colors ${on ? 'border-brand text-brand' : 'border-border text-ink-secondary hover:text-ink'}`;

export default function EmailWriterCard({ he = true }: { he?: boolean }) {
  const [action, setAction] = useState<'write' | 'rewrite'>('write');
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [tone, setTone] = useState('מקצועי וחם');
  const [text, setText] = useState('');
  const [result, setResult] = useState<EmailResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    setError('');
    setResult(null);
    start(async () => {
      const input = { action, language, tone, text };
      async function preview() {
        const r = await fetch('/api/content-tool', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'email', email: input }),
        }).then((x) => x.json()).catch(() => null);
        if (r?.ok && r.result) { setResult(r.result); return; }
        setError(r?.error === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך טקסט.');
      }
      try {
        const res = await emailAction(input);
        if ('result' in res && res.result) { setResult(res.result); return; }
        const err = (res as { error?: string }).error;
        if (err === 'unauthorized' || err === 'no_workspace') { await preview(); return; }
        setError(err === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך טקסט.');
      } catch {
        await preview();
      }
    });
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(`${result.subject}\n\n${result.body}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div className={CARD} dir={he ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-[18px] h-[18px] text-brand" />
        <h3 className="font-bold text-ink">מיילים · כתיבה ושכתוב</h3>
        <span className="text-[11px] text-ink-muted mr-auto">כלי תוכן · נדבך אחד מ־Performance</span>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">כתוב מייל מבריף קצר, או שכתב מייל קיים — בעברית או באנגלית.</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => setAction('write')} className={PILL(action === 'write')}>כתיבה</button>
        <button onClick={() => setAction('rewrite')} className={PILL(action === 'rewrite')}>שכתוב</button>
        <div className="mr-auto flex gap-2">
          <button onClick={() => setLanguage('he')} className={PILL(language === 'he')}>עברית</button>
          <button onClick={() => setLanguage('en')} className={PILL(language === 'en')}>EN</button>
        </div>
      </div>

      <input value={tone} onChange={(e) => setTone(e.target.value)} className={`${INPUT} mb-2`} placeholder="טון" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={`${INPUT} resize-y`}
        dir={language === 'en' ? 'ltr' : 'rtl'}
        placeholder={action === 'write' ? 'על מה המייל? מטרה, נמען, נקודות עיקריות…' : 'הדבק כאן את המייל הקיים לשכתוב…'} />

      <div className="mt-3">
        <button onClick={run} disabled={pending || !text.trim()} className={BTN}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {pending ? 'מעבד…' : action === 'write' ? 'כתוב מייל' : 'שכתב מייל'}
        </button>
      </div>
      {error && <p className="text-[13px] text-red-400 mt-3">{error}</p>}

      {result && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-ink-secondary font-semibold">התוצאה</span>
            <button onClick={copy} className={GHOST}>
              {copied ? <Check className="w-4 h-4 text-brand" /> : <Copy className="w-4 h-4" />}
              {copied ? 'הועתק' : 'העתק'}
            </button>
          </div>
          {result.subject && <div className="text-[14px] font-bold text-ink mb-2" dir={language === 'en' ? 'ltr' : 'rtl'}>נושא: {result.subject}</div>}
          <pre className="whitespace-pre-wrap text-[14px] text-ink bg-bg/40 border border-border rounded-[10px] p-3 leading-relaxed"
            dir={language === 'en' ? 'ltr' : 'rtl'}>{result.body}</pre>
        </div>
      )}
    </div>
  );
}
