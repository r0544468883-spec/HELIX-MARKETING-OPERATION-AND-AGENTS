'use client';
// Coach Studio — the visual "?/100" scorer. Two engines:
//   • Content Coach: score a draft before publishing (per channel) + fixes + rewrite
//   • Presence Score: audit a profile/presence (per channel) + fixes
// Talks to /api/coach/{content,presence}.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ClipboardCheck, Copy, Wand2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type Channel = { key: string; label: string };
type Dim = { key: string; label: string; score: number; weight: number; status?: string; findings: string; fixes: string[] };
type ContentResult = { overall: number; channelLabel: string; dimensions: Dim[]; bestTime: { suggestion: string; reason: string }; improved: string; summary: string };
type PresenceResult = { overall: number; channelLabel: string; criteria: Dim[]; topFixes: string[]; summary: string };

const scoreColor = (n: number) => (n >= 75 ? '#10b981' : n >= 50 ? '#f59e0b' : '#ef4444');

function Gauge({ value }: { value: number }) {
  const r = 54, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: 140, height: 140 }}>
      <svg width={140} height={140} className="-rotate-90">
        <circle cx={70} cy={70} r={r} fill="none" stroke="var(--border)" strokeWidth={10} />
        <motion.circle cx={70} cy={70} r={r} fill="none" stroke={scoreColor(value)} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: off }} transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold" style={{ color: scoreColor(value) }}>{value}</div>
        <div className="text-xs text-ink-muted">/100</div>
      </div>
    </div>
  );
}

function Bar({ d }: { d: Dim }) {
  const pct = Math.round((d.score / 10) * 100);
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-ink">{d.label}</span>
        <span className="text-xs font-semibold" style={{ color: scoreColor(pct) }}>{d.score}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-bg overflow-hidden mb-2">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: scoreColor(pct) }} />
      </div>
      {d.findings && <p className="text-xs text-ink-secondary leading-relaxed">{d.findings}</p>}
      {d.fixes?.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {d.fixes.map((f, i) => <li key={i} className="text-xs text-ink-muted flex gap-1.5"><span className="text-brand">↳</span>{f}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function CoachStudio() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'content' | 'presence'>('content');
  const [contentChannels, setContentChannels] = useState<Channel[]>([]);
  const [presenceChannels, setPresenceChannels] = useState<Channel[]>([]);
  const [busy, setBusy] = useState(false);

  // content state
  const [cChannel, setCChannel] = useState('linkedin');
  const [subject, setSubject] = useState('');
  const [goal, setGoal] = useState('');
  const [audience, setAudience] = useState('');
  const [draft, setDraft] = useState('');
  const [cRes, setCRes] = useState<ContentResult | null>(null);

  // presence state
  const [pChannel, setPChannel] = useState('linkedin');
  const [profile, setProfile] = useState('');
  const [pRes, setPRes] = useState<PresenceResult | null>(null);

  useEffect(() => {
    fetch('/api/coach/content').then((r) => r.json()).then((j) => setContentChannels(j.channels ?? [])).catch(() => {});
    fetch('/api/coach/presence').then((r) => r.json()).then((j) => setPresenceChannels(j.channels ?? [])).catch(() => {});
  }, []);

  const runContent = async () => {
    if (!draft.trim()) return toast('הדביקו טיוטה לדירוג', 'error');
    setBusy(true); setCRes(null);
    try {
      const r = await fetch('/api/coach/content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: cChannel, draft, subject: cChannel === 'email' ? subject : undefined, goal, audience }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      setCRes(j);
    } catch (e) { toast(e instanceof Error ? e.message : 'הדירוג נכשל', 'error'); }
    setBusy(false);
  };

  const runPresence = async () => {
    if (!profile.trim()) return toast('הדביקו את פרטי הפרופיל', 'error');
    setBusy(true); setPRes(null);
    try {
      const r = await fetch('/api/coach/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: pChannel, profile }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'failed');
      setPRes(j);
    } catch (e) { toast(e instanceof Error ? e.message : 'הדירוג נכשל', 'error'); }
    setBusy(false);
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast('הועתק', 'success'); };

  const field = 'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand';
  const btn = 'inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-bg hover:bg-brand-hover disabled:opacity-50';

  return (
    <div dir="rtl" className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-brand" />
        <h1 className="text-2xl font-bold text-ink">מאמן התוכן והנוכחות</h1>
      </div>
      <p className="mb-6 text-sm text-ink-muted">דרגו כל טיוטה לפני פרסום, או אבחנו פרופיל — לפי ערוץ. ציון 0-100 + תיקונים פרקטיים.</p>

      <div className="mb-6 flex gap-2">
        {(['content', 'presence'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${tab === t ? 'border-brand bg-brand/15 text-brand' : 'border-border bg-surface text-ink-muted'}`}>
            {t === 'content' ? 'מאמן תוכן' : 'ציון נוכחות'}
          </button>
        ))}
      </div>

      {tab === 'content' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs text-ink-muted">ערוץ</span>
              <select className={field} value={cChannel} onChange={(e) => setCChannel(e.target.value)}>
                {contentChannels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs text-ink-muted">מטרה (אופציונלי)</span><input className={field} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="למשל הרשמות לוובינר" /></label>
            <label className="block"><span className="mb-1 block text-xs text-ink-muted">קהל יעד (אופציונלי)</span><input className={field} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="מנהלי שיווק B2B" /></label>
          </div>
          {cChannel === 'email' && <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="שורת נושא" />}
          <textarea className={`${field} min-h-[160px] resize-y`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="הדביקו כאן את הטיוטה לדירוג…" />
          <button className={btn} onClick={runContent} disabled={busy}><ClipboardCheck className="h-4 w-4" />{busy ? 'מדרג…' : 'דרג את הטיוטה'}</button>

          {cRes && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:gap-6">
                <Gauge value={cRes.overall} />
                <div className="flex-1">
                  <div className="mb-1 text-sm font-semibold text-ink">{cRes.channelLabel}</div>
                  <p className="text-sm text-ink-secondary">{cRes.summary}</p>
                  {cRes.bestTime?.suggestion && <p className="mt-2 text-xs text-ink-muted">🕒 <b>{cRes.bestTime.suggestion}</b> — {cRes.bestTime.reason}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{cRes.dimensions.map((d) => <Bar key={d.key} d={d} />)}</div>
              {cRes.improved && (
                <div className="rounded-xl border border-brand/30 bg-brand/15 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-brand"><Wand2 className="h-4 w-4" />גרסה משופרת</span>
                    <button className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink" onClick={() => copy(cRes.improved)}><Copy className="h-3.5 w-3.5" />העתק</button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ink leading-relaxed">{cRes.improved}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block"><span className="mb-1 block text-xs text-ink-muted">ערוץ</span>
            <select className={field} value={pChannel} onChange={(e) => setPChannel(e.target.value)}>
              {presenceChannels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select></label>
          <textarea className={`${field} min-h-[180px] resize-y`} value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="הדביקו את פרטי הפרופיל (Headline, About, ניסיון, קישורים…) או תיאור חופשי של הנוכחות" />
          <button className={btn} onClick={runPresence} disabled={busy}><ClipboardCheck className="h-4 w-4" />{busy ? 'מאבחן…' : 'אבחן את הפרופיל'}</button>

          {pRes && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:gap-6">
                <Gauge value={pRes.overall} />
                <div className="flex-1">
                  <div className="mb-1 text-sm font-semibold text-ink">{pRes.channelLabel}</div>
                  <p className="text-sm text-ink-secondary">{pRes.summary}</p>
                </div>
              </div>
              {pRes.topFixes?.length > 0 && (
                <div className="rounded-xl border border-brand/30 bg-brand/15 p-4">
                  <div className="mb-2 text-sm font-semibold text-brand">התיקונים בעלי ההשפעה הגבוהה ביותר</div>
                  <ol className="space-y-1.5">{pRes.topFixes.map((f, i) => <li key={i} className="flex gap-2 text-sm text-ink"><span className="font-bold text-brand">{i + 1}.</span>{f}</li>)}</ol>
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{pRes.criteria.map((d) => <Bar key={d.key} d={d} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
