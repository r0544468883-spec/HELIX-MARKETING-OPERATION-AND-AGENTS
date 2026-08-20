'use client';

// Content DNA card — one tool inside the Performance Tools grid (NOT a standalone page).
// Paste 2–8 posts that worked → Claude decomposes them into 4 recurring genes, surfaces
// the shared formula + why it works, and hands back a fill-in template for the next post.
// Sibling of StyleLearner / CampaignBuilder; deliberately a peer card, not a hero.

import { useState, useTransition } from 'react';
import { Dna, Sparkles, Plus, X, Copy, Check, Loader2, Mic } from 'lucide-react';
import { analyzeContentDna, learnVoice } from '@/app/actions-performance';
import type { ContentDna } from '@/lib/performance/content-dna';

type Voice = { keyTells: string[]; signaturePassages: string[]; summary: string; tier: string; words: number; lang: 'he' | 'en' };

const CARD = 'border border-border rounded-[14px] p-5 bg-soft/30';
const INPUT = 'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand';
const BTN = 'glow inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] disabled:opacity-60 active:scale-95 transition-all';
const GHOST = 'inline-flex items-center gap-2 border border-border hover:bg-soft text-ink-secondary hover:text-ink px-3 py-1.5 rounded-[10px] text-[13px] transition-colors';

const EXAMPLES = [
  'לפני שלוש שנים פיטרו אותי משלוש עבודות ברצף. חשבתי שאני לא טוב במה שאני עושה. התברר שהבעיה לא הייתה אני — הייתה המערכת. ברגע שהבנתי את זה, הקמתי עסק שמייצר 40K בחודש. ספרו לי בתגובות — איפה אתם תקועים היום?',
  'רוב היועצים יגידו לכם להתמקד בפיד. אני אגיד לכם בדיוק את ההפך. הלקוחות שלי לא מגיעים מהפיד. הם מגיעים מ-3 דקות שיחת DM ביום. מה הייתם שואלים את הלקוח האידיאלי שלכם?',
  'שאלה: למה רוב הקריאייטורים שורפים את עצמם? התשובה פשוטה — הם רודפים אחרי וויראליות. אני שיניתי כיוון — מעקב אחרי לקוחות, לא לייקים. ב-6 חודשים: 12 לקוחות פרימיום, אפס שעות שריפה. מה הייתם מוכנים לוותר עליו כדי לעבוד פחות?',
];

const GENE_LABELS: Record<keyof ContentDna['formula'], string> = {
  opener: 'פתיח',
  topic: 'נושא',
  format: 'פורמט',
  ending: 'סיום',
};

export default function ContentDnaCard({ he = true }: { he?: boolean }) {
  const [posts, setPosts] = useState<string[]>(['', '', '']);
  const [dna, setDna] = useState<ContentDna | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  // Voice — learn HOW the operator sounds (not just the structure) and save it as their voice.
  const [voice, setVoice] = useState<Voice | null>(null);
  const [voiceMsg, setVoiceMsg] = useState('');
  const [voicePending, startVoice] = useTransition();

  function learnMyVoice() {
    setVoiceMsg('');
    setVoice(null);
    startVoice(async () => {
      async function preview() {
        const r = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ posts }),
        }).then((x) => x.json()).catch(() => null);
        if (r?.ok && r.voice) { setVoice(r.voice as Voice); setVoiceMsg('הקול נלמד (תצוגה מקומית — לא נשמר).'); return; }
        setVoiceMsg(r?.error === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך לפחות דוגמה אחת.');
      }
      try {
        const res = await learnVoice(posts);
        if ('voice' in res && res.voice) { setVoice(res.voice as Voice); setVoiceMsg('הקול שלך נלמד ונשמר ✅ כל פוסט חדש ייכתב בסגנון שלך.'); return; }
        const err = (res as { error?: string }).error;
        if (err === 'unauthorized' || err === 'no_workspace') { await preview(); return; }
        setVoiceMsg(err === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך לפחות דוגמה אחת.');
      } catch {
        await preview();
      }
    });
  }

  const filled = posts.filter((p) => p.trim()).length;
  const setPost = (i: number, v: string) => setPosts((p) => p.map((x, j) => (j === i ? v : x)));
  const addPost = () => setPosts((p) => (p.length < 8 ? [...p, ''] : p));
  const removePost = (i: number) => setPosts((p) => (p.length > 2 ? p.filter((_, j) => j !== i) : p));

  function analyze() {
    setError('');
    setDna(null);
    setDemo(false);
    start(async () => {
      // Local preview: no logged-in workspace (or no Supabase env on localhost) → run the
      // engine via the dev-only /api/content-dna route. No effect in production.
      async function preview() {
        const r = await fetch('/api/content-dna', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ posts }),
        })
          .then((x) => x.json())
          .catch(() => null);
        if (r?.ok && r.dna) {
          setDna(r.dna as ContentDna);
          setDemo(Boolean(r.demo));
          return true;
        }
        setError(r?.error === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך לפחות 2 פוסטים.');
        return true;
      }
      try {
        const res = await analyzeContentDna(posts);
        if ('dna' in res && res.dna) {
          setDna(res.dna);
          return;
        }
        const err = (res as { error?: string }).error;
        if (err === 'unauthorized' || err === 'no_workspace') {
          await preview();
          return;
        }
        setError(err === 'missing_api_key' ? 'חסר ANTHROPIC_API_KEY בהגדרות הסביבה.' : 'צריך לפחות 2 פוסטים.');
      } catch {
        // Server action threw (e.g. missing Supabase env on localhost) — fall back to preview.
        await preview();
      }
    });
  }

  const template = dna
    ? [dna.template.opener, dna.template.topic, dna.template.format, dna.template.ending].filter(Boolean).join('\n')
    : '';

  function copyTemplate() {
    if (!template) return;
    navigator.clipboard.writeText(template).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className={CARD} dir={he ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 mb-1">
        <Dna className="w-[18px] h-[18px] text-brand" />
        <h3 className="font-bold text-ink">Content DNA</h3>
        <span className="text-[11px] text-ink-muted mr-auto">כלי תוכן · נדבך אחד מ־Performance</span>
      </div>
      <p className="text-[13px] text-ink-secondary mb-4">
        הדבק 2–8 פוסטים שעבדו — נחלץ את הנוסחה החוזרת, ונלמד את הקול האותנטי שלך כדי שכל פוסט חדש ייכתב בסגנון שלך.
      </p>

      {/* Inputs */}
      <div className="grid gap-2">
        {posts.map((p, i) => (
          <div key={i} className="relative">
            <textarea
              value={p}
              onChange={(e) => setPost(i, e.target.value)}
              placeholder={`פוסט ${i + 1} — הדבק כאן תוכן שקיבל תגובות טובות…`}
              rows={2}
              className={`${INPUT} resize-y pl-8`}
            />
            {posts.length > 2 && (
              <button
                onClick={() => removePost(i)}
                aria-label="הסר פוסט"
                className="absolute top-2 left-2 text-ink-muted hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={analyze} disabled={pending || filled < 2} className={BTN}>
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {pending ? 'מנתח…' : 'גלה את הנוסחה'}
        </button>
        {posts.length < 8 && (
          <button onClick={addPost} className={GHOST}>
            <Plus className="w-4 h-4" /> פוסט
          </button>
        )}
        <button onClick={learnMyVoice} disabled={voicePending || filled < 1} className={GHOST}>
          {voicePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          {voicePending ? 'לומד קול…' : 'למד את הקול שלי'}
        </button>
        <button onClick={() => setPosts([...EXAMPLES])} className={GHOST}>
          נסה עם דוגמאות
        </button>
        <span className="text-[12px] text-ink-muted mr-auto">{filled}/{posts.length} מוכנים · צריך לפחות 2</span>
      </div>

      {error && <p className="text-[13px] text-red-400 mt-3">{error}</p>}

      {/* Voice — the operator's own authentic voice, saved for every future post */}
      {(voice || voiceMsg) && (
        <div className="mt-3 rounded-[12px] border border-brand/30 bg-brand/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-4 h-4 text-brand" />
            <span className="text-[12px] font-bold text-brand">הקול שלך</span>
            {voice?.tier && <span className="text-[10px] text-ink-muted">· דיוק {voice.tier === 'full' ? 'מלא' : voice.tier === 'strong' ? 'גבוה' : 'בסיסי'}</span>}
          </div>
          {voiceMsg && <p className="text-[12px] text-ink-secondary mb-1.5">{voiceMsg}</p>}
          {voice?.summary && <p className="text-[13px] text-ink font-medium mb-1.5">{voice.summary}</p>}
          {voice && voice.keyTells.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {voice.keyTells.map((t, i) => (
                <span key={i} className="rounded-full bg-bg border border-border px-2.5 py-0.5 text-[11px] text-ink-secondary">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {dna && (
        <div className="mt-5 pt-5 border-t border-border grid gap-5">
          {/* Formula */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-wide text-brand font-bold">THE FORMULA</span>
              {demo && (
                <span className="text-[10px] text-amber-400 border border-amber-400/40 rounded-full px-2 py-0.5">
                  תצוגת דמו · ללא מפתח API
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[14px] text-ink font-semibold">
              {(['opener', 'topic', 'format', 'ending'] as const).map((k, i) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span>{dna.formula[k]}</span>
                  {i < 3 && <span className="text-ink-muted">·</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Per-gene consistency */}
          <div className="grid gap-2 sm:grid-cols-2">
            {(['opener', 'topic', 'format', 'ending'] as const).map((k) => {
              const n = dna.consistency[k];
              const total = dna.consistency.total || 1;
              return (
                <div key={k} className="border border-border rounded-[10px] p-3 bg-bg/40">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] text-ink-secondary">{GENE_LABELS[k]}</span>
                    <span className="text-[11px] text-ink-muted">{n} מתוך {total}</span>
                  </div>
                  <div className="text-[13px] text-ink font-medium mb-2">{dna.formula[k]}</div>
                  <div className="h-1.5 rounded-full bg-soft overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${(n / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Why it works */}
          {dna.why.length > 0 && (
            <div>
              <div className="text-[12px] text-ink-secondary font-semibold mb-2">למה הקהל מגיב</div>
              <ul className="grid gap-2">
                {dna.why.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-ink-secondary">
                    <span className="text-brand font-bold shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fill-in template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] text-ink-secondary font-semibold">תבנית לפוסט הבא</div>
              <button onClick={copyTemplate} className={GHOST}>
                {copied ? <Check className="w-4 h-4 text-brand" /> : <Copy className="w-4 h-4" />}
                {copied ? 'הועתק' : 'העתק'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-[13px] text-ink bg-bg/40 border border-border rounded-[10px] p-3 leading-relaxed">
              {template}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
