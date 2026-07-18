'use client';

import { useState } from 'react';
import {
  setKillSwitch,
  approveEngagementAction,
  rejectEngagementAction,
} from '@/app/actions-engagement';

export type LimitRow = {
  channel: string;
  daily_cap: number;
  used_today: number;
  warmup_stage: number;
  risk_level: 'green' | 'amber' | 'red';
  paused: boolean;
};

export type ActionRow = { id: string; channel: string; type: string; content: string | null };

const RISK_COLOR: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

export default function ExposureMeter({
  limits,
  actions,
}: {
  limits: LimitRow[];
  actions: ActionRow[];
}) {
  const [rows, setRows] = useState<LimitRow[]>(limits);
  const [queue, setQueue] = useState<ActionRow[]>(actions);

  async function togglePause(channel: string, paused: boolean) {
    setRows((r) => r.map((l) => (l.channel === channel ? { ...l, paused } : l)));
    await setKillSwitch(channel, paused);
  }

  async function pauseAll() {
    setRows((r) => r.map((l) => ({ ...l, paused: true })));
    await setKillSwitch(null, true);
  }

  async function decide(id: string, approve: boolean) {
    setQueue((q) => q.filter((a) => a.id !== id));
    if (approve) await approveEngagementAction(id);
    else await rejectEngagementAction(id);
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-[18px] font-bold">מכסות וחשיפה</h2>
          <button
            onClick={pauseAll}
            className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-[13px] font-semibold"
          >
            עצור הכל (kill-switch)
          </button>
        </div>
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-ink-secondary text-[14px]">אין עדיין פעילות engagement.</p>
          )}
          {rows.map((l) => {
            const pct = l.daily_cap > 0 ? Math.min(100, Math.round((l.used_today / l.daily_cap) * 100)) : 0;
            return (
              <div key={l.channel} className="rounded-lg border border-black/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={'w-2.5 h-2.5 rounded-full ' + (RISK_COLOR[l.risk_level] ?? 'bg-black/30')} />
                    <span className="text-[14px] font-semibold">{l.channel}</span>
                    <span className="text-[12px] text-ink-secondary">warm-up שלב {l.warmup_stage}</span>
                  </div>
                  <button
                    onClick={() => togglePause(l.channel, !l.paused)}
                    className={
                      'rounded-full px-3 py-1 text-[12px] font-semibold ' +
                      (l.paused ? 'bg-black/5 text-ink-secondary' : 'bg-emerald-100 text-emerald-800')
                    }
                  >
                    {l.paused ? 'מושהה' : 'פעיל'}
                  </button>
                </div>
                <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                  <div className={'h-full ' + (RISK_COLOR[l.risk_level] ?? 'bg-black/30')} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[12px] text-ink-secondary mt-1">
                  {l.used_today}/{l.daily_cap} היום
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[18px] font-bold mb-4">תור אישורים (HITL)</h2>
        <div className="space-y-3">
          {queue.length === 0 && (
            <p className="text-ink-secondary text-[14px]">אין הצעות ממתינות. הכל שקט 🙂</p>
          )}
          {queue.map((a) => (
            <div key={a.id} className="rounded-lg border border-black/10 p-4">
              <div className="text-[12px] text-ink-secondary mb-1">
                {a.channel} · {a.type}
              </div>
              <div className="text-[14px] mb-3">{a.content}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => decide(a.id, true)}
                  className="rounded-lg bg-black text-white px-3 py-1.5 text-[13px] font-semibold"
                >
                  אשר
                </button>
                <button
                  onClick={() => decide(a.id, false)}
                  className="rounded-lg bg-black/5 text-ink-secondary px-3 py-1.5 text-[13px] font-semibold"
                >
                  דחה
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
