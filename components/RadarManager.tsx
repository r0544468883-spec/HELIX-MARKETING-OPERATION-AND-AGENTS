'use client';

import { useState } from 'react';
import {
  createRadar,
  setRadarActive,
  setLeadStatus,
  convertLeadToEngagement,
} from '@/app/actions-radar';

export type RadarRow = {
  id: string;
  name: string;
  keywords: string[];
  min_intent: number;
  alert_channels: string[];
  active: boolean;
};

export type LeadRow = {
  id: string;
  source: string;
  post_url: string | null;
  content: string | null;
  intent_score: number | null;
  matched: string[];
  status: 'new' | 'contacted' | 'saved' | 'dismissed';
};

const input =
  'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none focus:border-black/30';
const label = 'block text-[13px] font-semibold mb-1';
const ALERT_CHANNELS = ['טלגרם', 'וואטסאפ', 'מייל'];

export default function RadarManager({ radars, leads }: { radars: RadarRow[]; leads: LeadRow[] }) {
  const [radarRows, setRadarRows] = useState<RadarRow[]>(radars);
  const [leadRows, setLeadRows] = useState<LeadRow[]>(leads);
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [icp, setIcp] = useState('');
  const [channels, setChannels] = useState<string[]>(['טלגרם']);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleChannel(c: string) {
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  async function submit() {
    const kws = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (!name.trim() || kws.length === 0) {
      setMsg('צריך שם ולפחות מילת מפתח אחת.');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await createRadar({ name: name.trim(), keywords: kws, icp, alert_channels: channels });
    setBusy(false);
    if ('error' in res && res.error) {
      setMsg('שגיאה: ' + res.error);
      return;
    }
    setRadarRows((r) => [
      { id: crypto.randomUUID(), name: name.trim(), keywords: kws, min_intent: 0.7, alert_channels: channels, active: true },
      ...r,
    ]);
    setName('');
    setKeywords('');
    setIcp('');
    setMsg('רדאר נוצר ✓');
  }

  async function toggleRadar(id: string, active: boolean) {
    setRadarRows((r) => r.map((x) => (x.id === id ? { ...x, active } : x)));
    await setRadarActive(id, active);
  }

  async function leadAction(id: string, status: LeadRow['status']) {
    setLeadRows((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
    await setLeadStatus(id, status);
  }

  async function convert(id: string) {
    setLeadRows((l) => l.map((x) => (x.id === id ? { ...x, status: 'contacted' } : x)));
    await convertLeadToEngagement(id);
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-black/10 p-5 space-y-4">
        <h2 className="font-display text-[18px] font-bold">רדאר חדש</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>שם</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="לקוחות ביטוח" />
          </div>
          <div>
            <label className={label}>מילות מפתח (פסיק)</label>
            <input className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ממליץ, מחפש, המלצה על" />
          </div>
        </div>
        <div>
          <label className={label}>מיהו הלקוח האידיאלי (ל-AI intent)</label>
          <input className={input} value={icp} onChange={(e) => setIcp(e.target.value)} placeholder="בעל עסק שמחפש סוכן ביטוח" />
        </div>
        <div>
          <label className={label}>ערוצי התראה</label>
          <div className="flex gap-2">
            {ALERT_CHANNELS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleChannel(c)}
                className={
                  'rounded-full px-3 py-1 text-[13px] font-semibold ' +
                  (channels.includes(c) ? 'bg-black text-white' : 'bg-black/5 text-ink-secondary')
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={busy} className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold disabled:opacity-50">
            {busy ? 'יוצר…' : 'צור רדאר'}
          </button>
          {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[18px] font-bold mb-4">רדארים פעילים</h2>
        <div className="space-y-2">
          {radarRows.length === 0 && <p className="text-ink-secondary text-[14px]">עוד אין רדארים.</p>}
          {radarRows.map((r) => (
            <div key={r.id} className="rounded-lg border border-black/10 p-3 flex items-center justify-between">
              <div className="text-[14px]">
                <span className="font-semibold">{r.name}</span>{' '}
                <span className="text-ink-secondary">· {r.keywords.join(', ')} · {r.alert_channels.join('/')}</span>
              </div>
              <button
                onClick={() => toggleRadar(r.id, !r.active)}
                className={'rounded-full px-3 py-1 text-[12px] font-semibold ' + (r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-ink-secondary')}
              >
                {r.active ? 'פעיל' : 'כבוי'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[18px] font-bold mb-4">לידים נכנסים</h2>
        <div className="space-y-3">
          {leadRows.length === 0 && <p className="text-ink-secondary text-[14px]">עוד אין לידים. הרדאר ישלח התראה ברגע שיזהה אחד.</p>}
          {leadRows.map((l) => (
            <div key={l.id} className={'rounded-lg border border-black/10 p-4 ' + (l.status === 'dismissed' ? 'opacity-50' : '')}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-ink-secondary">
                  {l.source} · intent {l.intent_score != null ? Math.round(l.intent_score * 100) : '?'}% · {l.matched.join(', ')}
                </span>
                <span className="text-[12px] font-semibold">{l.status}</span>
              </div>
              <div className="text-[14px] mb-3">{l.content}</div>
              <div className="flex flex-wrap gap-2">
                {l.post_url && (
                  <a href={l.post_url} target="_blank" rel="noreferrer" className="rounded-lg bg-black/5 text-ink-secondary px-3 py-1.5 text-[13px] font-semibold">
                    לפוסט
                  </a>
                )}
                <button onClick={() => convert(l.id)} className="rounded-lg bg-black text-white px-3 py-1.5 text-[13px] font-semibold">
                  צור פנייה
                </button>
                <button onClick={() => leadAction(l.id, 'saved')} className="rounded-lg bg-black/5 text-ink-secondary px-3 py-1.5 text-[13px] font-semibold">
                  שמור
                </button>
                <button onClick={() => leadAction(l.id, 'dismissed')} className="rounded-lg bg-black/5 text-ink-secondary px-3 py-1.5 text-[13px] font-semibold">
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
