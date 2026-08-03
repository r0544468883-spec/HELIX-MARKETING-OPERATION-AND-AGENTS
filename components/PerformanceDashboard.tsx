'use client';

import { useState, useTransition } from 'react';
import { Plus, Play, Check, X, TrendingUp, Pause, Sparkles, Loader2 } from 'lucide-react';
import {
  addCreative,
  setMetric,
  saveSettings,
  runNow,
  resolveDecision,
  setCreativeStatus,
} from '@/app/actions-performance';

type Metric = 'cpa' | 'roas' | 'cpl' | 'ctr';
type Action = 'pause' | 'scale_up' | 'scale_down' | 'promote' | 'keep';

type Settings = {
  metric: Metric;
  execution_mode: 'brain' | 'connector';
  autonomy: 'approve' | 'autopilot';
  pause_below: number;
  promote_above: number;
};

type Scored = {
  id: string;
  name: string;
  platform: string;
  status: 'draft' | 'live' | 'paused' | 'retired';
  coldStart: number;
  inFlight: number | null;
  confidence: number;
  blended: number;
  value: number | null;
  action: Action;
  reason: string;
  coldReason: string | null;
};

type Decision = {
  id: string;
  creative_id: string | null;
  action: Action;
  reason: string;
  score: number | null;
  confidence: number | null;
  status: string;
};

const METRICS: Metric[] = ['cpa', 'roas', 'cpl', 'ctr'];

export default function PerformanceDashboard({
  locale,
  settings,
  scored,
  decisions,
}: {
  locale: string;
  settings: Settings | null;
  scored: Scored[];
  decisions: Decision[];
}) {
  const he = locale !== 'en';
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const s = settings ?? { metric: 'cpa' as Metric, execution_mode: 'brain' as const, autonomy: 'approve' as const, pause_below: 35, promote_above: 70 };

  const t = he
    ? {
        title: 'פרפורמנס',
        subtitle: 'סקורינג לקריאייטיבים (AI + הדאטה שלך), החלפה ותעדוף תקציב.',
        metric: 'מדד יעד',
        mode: 'מצב ביצוע',
        brain: 'מוח (החלטות בלבד)',
        connector: 'קונקטור (גם מבצע)',
        autonomy: 'אוטונומיה',
        approve: 'אישור ידני',
        autopilot: 'טייס אוטומטי',
        run: 'הרץ סקורינג עכשיו',
        add: 'קריאייטיב חדש',
        pool: 'פּוּל קריאייטיבים',
        pendingTitle: 'החלטות ממתינות לאישור',
        empty: 'אין עדיין קריאייטיבים. הוסף לפּוּל כדי לקבל ציון.',
        noPending: 'אין החלטות ממתינות.',
        cold: 'AI', flight: 'דאטה', conf: 'ביטחון', score: 'ציון', rec: 'המלצה',
        approve_btn: 'אשר', reject_btn: 'דחה',
        launch: 'הפעל', pause: 'השהה', retire: 'הוצא',
      }
    : {
        title: 'Performance',
        subtitle: 'Creative scoring (AI + your data), swapping & budget prioritization.',
        metric: 'Objective',
        mode: 'Execution mode',
        brain: 'Brain (decisions only)',
        connector: 'Connector (also acts)',
        autonomy: 'Autonomy',
        approve: 'Approve mode',
        autopilot: 'Autopilot',
        run: 'Run scoring now',
        add: 'New creative',
        pool: 'Creative pool',
        pendingTitle: 'Decisions awaiting approval',
        empty: 'No creatives yet. Add to the pool to get a score.',
        noPending: 'No pending decisions.',
        cold: 'AI', flight: 'Data', conf: 'Conf.', score: 'Score', rec: 'Action',
        approve_btn: 'Approve', reject_btn: 'Reject',
        launch: 'Launch', pause: 'Pause', retire: 'Retire',
      };

  const run = (fn: () => Promise<unknown>) => start(() => void fn());

  return (
    <div className="max-w-[1280px] mx-auto px-5 md:px-10 py-8" dir={he ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl tracking-tight">{t.title}</h1>
          <p className="mt-2 text-ink-secondary max-w-xl text-[15px]">{t.subtitle}</p>
        </div>
        <button
          onClick={() => run(() => runNow())}
          disabled={pending}
          className="glow inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] transition-all active:scale-95 disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {t.run}
        </button>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Control label={t.metric}>
          <select
            value={s.metric}
            onChange={(e) => run(() => setMetric(e.target.value as Metric))}
            className="bg-transparent text-ink font-semibold outline-none cursor-pointer"
          >
            {METRICS.map((m) => (
              <option key={m} value={m} className="bg-bg text-ink">{m.toUpperCase()}</option>
            ))}
          </select>
        </Control>
        <Control label={t.mode}>
          <select
            value={s.execution_mode}
            onChange={(e) => run(() => saveSettings({ execution_mode: e.target.value as 'brain' | 'connector' }))}
            className="bg-transparent text-ink font-semibold outline-none cursor-pointer"
          >
            <option value="brain" className="bg-bg text-ink">{t.brain}</option>
            <option value="connector" className="bg-bg text-ink">{t.connector}</option>
          </select>
        </Control>
        <Control label={t.autonomy}>
          <select
            value={s.autonomy}
            onChange={(e) => run(() => saveSettings({ autonomy: e.target.value as 'approve' | 'autopilot' }))}
            className="bg-transparent text-ink font-semibold outline-none cursor-pointer"
          >
            <option value="approve" className="bg-bg text-ink">{t.approve}</option>
            <option value="autopilot" className="bg-bg text-ink">{t.autopilot}</option>
          </select>
        </Control>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-2 border border-border hover:bg-soft text-ink-secondary hover:text-ink px-4 py-2 rounded-[10px] transition-colors"
        >
          <Plus size={16} /> {t.add}
        </button>
      </div>

      {showAdd && <AddCreativeForm he={he} onDone={() => setShowAdd(false)} pending={pending} start={run} />}

      {/* Pending decisions */}
      {decisions.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold text-lg mb-3">{t.pendingTitle}</h2>
          <div className="space-y-2">
            {decisions.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-4 border border-border rounded-[12px] px-4 py-3 bg-soft/40">
                <div className="flex items-center gap-3 min-w-0">
                  <ActionBadge action={d.action} he={he} />
                  <span className="text-[14px] text-ink-secondary truncate">{d.reason}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => run(() => resolveDecision(d.id, true))}
                    disabled={pending}
                    className="inline-flex items-center gap-1 bg-brand hover:bg-brand-hover text-bg text-[13px] font-bold px-3 py-1.5 rounded-[8px] disabled:opacity-60"
                  >
                    <Check size={14} /> {t.approve_btn}
                  </button>
                  <button
                    onClick={() => run(() => resolveDecision(d.id, false))}
                    disabled={pending}
                    className="inline-flex items-center gap-1 border border-border hover:bg-soft text-ink-secondary text-[13px] px-3 py-1.5 rounded-[8px] disabled:opacity-60"
                  >
                    <X size={14} /> {t.reject_btn}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Score table */}
      <section className="mt-8">
        <h2 className="font-bold text-lg mb-3">{t.pool}</h2>
        {scored.length === 0 ? (
          <div className="border border-dashed border-border rounded-[12px] p-10 text-center text-ink-secondary">{t.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] border-separate border-spacing-y-1">
              <thead className="text-ink-secondary text-[12px] uppercase tracking-wide">
                <tr>
                  <Th he={he}>{he ? 'קריאייטיב' : 'Creative'}</Th>
                  <Th he={he}>{he ? 'פלטפורמה' : 'Platform'}</Th>
                  <Th he={he}>{t.cold}</Th>
                  <Th he={he}>{t.flight}</Th>
                  <Th he={he}>{t.conf}</Th>
                  <Th he={he}>{t.score}</Th>
                  <Th he={he}>{t.rec}</Th>
                  <Th he={he}></Th>
                </tr>
              </thead>
              <tbody>
                {scored.map((c) => (
                  <tr key={c.id} className="bg-soft/40">
                    <td className="px-3 py-2.5 rounded-s-[10px]">
                      <div className="font-semibold text-ink">{c.name}</div>
                      {c.coldReason && <div className="text-[12px] text-ink-secondary truncate max-w-[240px]">{c.coldReason}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-ink-secondary">{c.platform}</td>
                    <td className="px-3 py-2.5"><Pill n={c.coldStart} /></td>
                    <td className="px-3 py-2.5">{c.inFlight === null ? <span className="text-ink-secondary">—</span> : <Pill n={c.inFlight} />}</td>
                    <td className="px-3 py-2.5"><ConfBar v={c.confidence} /></td>
                    <td className="px-3 py-2.5"><BigScore n={c.blended} /></td>
                    <td className="px-3 py-2.5"><ActionBadge action={c.action} he={he} /></td>
                    <td className="px-3 py-2.5 rounded-e-[10px]">
                      <StatusControl c={c} he={he} t={t} pending={pending} start={run} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border border-border rounded-[10px] px-3 py-2 bg-soft/40">
      <span className="text-[12px] text-ink-secondary">{label}</span>
      {children}
    </div>
  );
}

function Th({ children, he }: { children?: React.ReactNode; he: boolean }) {
  return <th className={`px-3 py-1 font-medium ${he ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function scoreColor(n: number): string {
  if (n >= 70) return 'text-emerald-400';
  if (n >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function Pill({ n }: { n: number }) {
  return <span className={`font-semibold ${scoreColor(n)}`}>{Math.round(n)}</span>;
}

function BigScore({ n }: { n: number }) {
  return <span className={`font-display font-black text-lg ${scoreColor(n)}`}>{Math.round(n)}</span>;
}

function ConfBar({ v }: { v: number }) {
  return (
    <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
      <div className="h-full bg-brand" style={{ width: `${Math.round(v * 100)}%` }} />
    </div>
  );
}

function ActionBadge({ action, he }: { action: Action; he: boolean }) {
  const map: Record<Action, { label: string; cls: string; icon: React.ReactNode }> = {
    pause: { label: he ? 'להשהות' : 'Pause', cls: 'bg-red-500/15 text-red-400', icon: <Pause size={13} /> },
    scale_up: { label: he ? 'להגדיל תקציב' : 'Scale up', cls: 'bg-emerald-500/15 text-emerald-400', icon: <TrendingUp size={13} /> },
    scale_down: { label: he ? 'להקטין' : 'Scale down', cls: 'bg-amber-500/15 text-amber-400', icon: <TrendingUp size={13} className="rotate-180" /> },
    promote: { label: he ? 'להעלות מהפּוּל' : 'Launch', cls: 'bg-brand/15 text-brand', icon: <Sparkles size={13} /> },
    keep: { label: he ? 'להשאיר' : 'Keep', cls: 'bg-white/5 text-ink-secondary', icon: null },
  };
  const m = map[action];
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-[8px] ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}

function StatusControl({
  c, he, t, pending, start,
}: {
  c: Scored; he: boolean; t: Record<string, string>; pending: boolean; start: (fn: () => Promise<unknown>) => void;
}) {
  const btn = 'text-[12px] px-2 py-1 rounded-[7px] border border-border hover:bg-soft disabled:opacity-60';
  if (c.status === 'draft' || c.status === 'paused') {
    return <button className={btn} disabled={pending} onClick={() => start(() => setCreativeStatus(c.id, 'live'))}>{t.launch}</button>;
  }
  if (c.status === 'live') {
    return <button className={btn} disabled={pending} onClick={() => start(() => setCreativeStatus(c.id, 'paused'))}>{t.pause}</button>;
  }
  return <span className="text-[12px] text-ink-secondary">{he ? 'הוצא' : 'retired'}</span>;
}

function AddCreativeForm({
  he, onDone, pending, start,
}: {
  he: boolean; onDone: () => void; pending: boolean; start: (fn: () => Promise<unknown>) => void;
}) {
  const [f, setF] = useState({ name: '', platform: 'Meta', format: '', headline: '', body: '', hook: '', media_url: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const input = 'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand';
  const submit = () => {
    if (!f.name.trim()) return;
    start(async () => { await addCreative(f); onDone(); });
  };
  return (
    <div className="mt-4 border border-border rounded-[12px] p-4 grid gap-3 sm:grid-cols-2 bg-soft/30">
      <input className={input} placeholder={he ? 'שם *' : 'Name *'} value={f.name} onChange={set('name')} />
      <input className={input} placeholder={he ? 'פלטפורמה (Meta/TikTok/Google/Outbrain)' : 'Platform'} value={f.platform} onChange={set('platform')} />
      <input className={input} placeholder={he ? 'פורמט (video/image/carousel)' : 'Format'} value={f.format} onChange={set('format')} />
      <input className={input} placeholder={he ? 'הוק / שורת פתיחה' : 'Hook / opening'} value={f.hook} onChange={set('hook')} />
      <input className={input} placeholder={he ? 'כותרת' : 'Headline'} value={f.headline} onChange={set('headline')} />
      <input className={input} placeholder={he ? 'טקסט' : 'Body'} value={f.body} onChange={set('body')} />
      <input className={`${input} sm:col-span-2`} placeholder={he ? 'קישור מדיה (לניקוד ויזואלי)' : 'Media URL'} value={f.media_url} onChange={set('media_url')} />
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button onClick={onDone} className="text-[14px] text-ink-secondary hover:text-ink px-3 py-2">{he ? 'ביטול' : 'Cancel'}</button>
        <button onClick={submit} disabled={pending || !f.name.trim()} className="bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] disabled:opacity-60">
          {he ? 'הוסף לפּוּל' : 'Add to pool'}
        </button>
      </div>
    </div>
  );
}
