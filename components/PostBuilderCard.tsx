'use client';

// Post Builder — a content tool in the Performance Tools grid, sibling to Content DNA.
// Topic → ready-to-post copy (+ alternative hooks), any platform, HE/EN. Falls back to the
// dev-only /api/content-tool route when there's no logged-in workspace (localhost).

import { useState, useEffect, useTransition } from 'react';
import { PenLine, Copy, Check, Loader2, Mic } from 'lucide-react';
import { buildPostAction, getVoice } from '@/app/actions-performance';

type BuildResult = { post: string; hooks: string[] };
type Voice = { summary: string; keyTells: string[] };

const CARD = 'border border-border rounded-[14px] p-5 bg-soft/30';
const INPUT = 'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand';
const BTN = 'glow inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] disabled:opacity-60 active:scale-95 transition-all';
const GHOST = 'inline-flex items-center gap-2 border border-border hover:bg-soft text-ink-secondary hover:text-ink px-3 py-1.5 rounded-[10px] text-[13px] transition-colors';

export default function PostBuilderCard({ he = true }: { he?: boolean }) {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('LinkedIn');
  const [tone, setTone] = useState('אישי ודוגרי');
  const [language, setLanguage] = useState<'he' | 'en'>('he');
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  // Saved voice — when present, posts are written in the operator's own voice by default.
  const [voice, setVoice] = useState<Voice | null>(null);
  const [useMyVoice, setUseMyVoice] = useState(true);

  useEffect(() => {
    getVoice()
      .then((r) => { if ('voice' in r && r.voice) setVoice({ summary: r.voice.summary, keyTells: r.voice.keyTells }); })
      .catch(() => {});
  }, []);

  function run() {
    setError('');
    setResult(null);
    start(async () => {
      const input = { topic, platform, tone, language, useVoice: useMyVoice };
      async function preview() {
        const r = await fetch('/api/content-tool', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'build', build: input }),
        }).then((x) => x.json()).catch(() => null);
        if (r?.ok && r.result) { setResult(r.result); return; }
        setError(r?.error === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך נושא.');
      }
      try {
        const res = await buildPostAction(input);
        if ('result' in res && res.result) { setResult(res.result); return; }
        const err = (res as { error?: string }).error;
        if (err === 'unauthorized' || err === 'no_workspace') { await preview(); return; }
        setError(err === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך נושא.');
      } catch {
        await preview();
      }
    });
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result.post).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div className={CARD} dir={he ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 mb-1">
        <PenLine className="w-[18px] h-[18px] text-brand" />
        <h3 className="font-bold text-ink">בניית פוסט</h3>
        <span className="text-[11px] text-ink-muted mr-auto">כלי תוכן · נדבך אחד מ־Performance</span>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">תאר נושא — ונכתוב פוסט טבעי מוכן לפרסום, לכל פלטפורמה.</p>

      <div className="grid gap-3">
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} className={`${INPUT} resize-y`}
          placeholder="על מה הפוסט? למשל: איך סגרנו 3 לקוחות בלי לפרסם פוסט אחד…" />
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={INPUT}>
            {['LinkedIn', 'Instagram', 'Facebook', 'X / Twitter', 'כללי'].map((p) => <option key={p}>{p}</option>)}
          </select>
          <input value={tone} onChange={(e) => setTone(e.target.value)} className={INPUT} placeholder="טון" />
          <select value={language} onChange={(e) => setLanguage(e.target.value as 'he' | 'en')} className={INPUT}>
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {/* Voice toggle — write in the operator's own learned voice */}
      {voice && (
        <label className="flex items-start gap-2 mt-3 cursor-pointer">
          <input type="checkbox" checked={useMyVoice} onChange={(e) => setUseMyVoice(e.target.checked)} className="mt-0.5 accent-[var(--brand,#22c55e)]" />
          <span className="text-[13px]">
            <span className="inline-flex items-center gap-1 font-semibold text-ink"><Mic className="w-3.5 h-3.5 text-brand" /> כתוב בקול שלי</span>
            {voice.summary && <span className="text-ink-muted"> · {voice.summary}</span>}
          </span>
        </label>
      )}

      <div className="mt-3">
        <button onClick={run} disabled={pending || !topic.trim()} className={BTN}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
          {pending ? 'כותב…' : 'כתוב לי פוסט'}
        </button>
      </div>
      {error && <p className="text-[13px] text-red-400 mt-3">{error}</p>}

      {result && (
        <div className="mt-4 pt-4 border-t border-border grid gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-ink-secondary font-semibold">הפוסט</span>
            <button onClick={copy} className={GHOST}>
              {copied ? <Check className="w-4 h-4 text-brand" /> : <Copy className="w-4 h-4" />}
              {copied ? 'הועתק' : 'העתק'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-[14px] text-ink bg-bg/40 border border-border rounded-[10px] p-3 leading-relaxed"
            dir={language === 'en' ? 'ltr' : 'rtl'}>{result.post}</pre>
          {result.hooks.length > 0 && (
            <ul className="grid gap-1.5">
              {result.hooks.map((h, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-ink-secondary"><span className="text-brand">›</span>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
