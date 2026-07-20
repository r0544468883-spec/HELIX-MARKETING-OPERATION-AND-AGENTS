'use client';

import { useState } from 'react';
import { createSequence, setSequenceStatus, enrollContact } from '@/app/actions-marketing';

export type CampaignRow = { campaign: string; source: string; visits: number; conversions: number; revenue: number };
export type CityRow = { city: string; visits: number };
export type SequenceRow = { id: string; name: string; status: string; steps: number; activeEnrollments: number };
export type EmailLogRow = { email_to: string; subject: string; status: string; sent_at: string; opened_at: string | null; clicked_at: string | null };

const card = 'rounded-2xl border border-border bg-white/[0.02] p-5';
const input = 'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none focus:border-black/30';
const money = (n: number) => '₪' + n.toLocaleString('he-IL', { maximumFractionDigits: 0 });

export default function MarketingManager({
  campaigns, cities, sequences, emailLog,
}: { campaigns: CampaignRow[]; cities: CityRow[]; sequences: SequenceRow[]; emailLog: EmailLogRow[] }) {
  const [tab, setTab] = useState<'attribution' | 'sequences'>('attribution');

  const totalVisits = campaigns.reduce((s, c) => s + c.visits, 0);
  const totalConv = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalRev = campaigns.reduce((s, c) => s + c.revenue, 0);
  const convRate = totalVisits ? Math.round((totalConv / totalVisits) * 100) : 0;

  return (
    <main className="max-w-[1100px] mx-auto px-5 md:px-10 pt-8 pb-16" dir="rtl">
      <div className="mb-1 text-[13px] font-bold text-brand">HELIX OPS</div>
      <h1 className="text-[clamp(22px,4vw,32px)] font-black tracking-tight mb-4">שיווק — ייחוס ורצפי-מייל</h1>

      <div className="flex gap-2 mb-6">
        {(['attribution', 'sequences'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${tab === k ? 'bg-brand text-bg' : 'bg-white/5 text-ink-secondary hover:text-ink'}`}>
            {k === 'attribution' ? 'ייחוס (Attribution)' : 'רצפי-מייל'}
          </button>
        ))}
      </div>

      {tab === 'attribution' ? (
        <AttributionTab campaigns={campaigns} cities={cities} totals={{ totalVisits, totalConv, totalRev, convRate }} />
      ) : (
        <SequencesTab sequences={sequences} emailLog={emailLog} />
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <div className="text-[13px] font-semibold text-ink-secondary mb-1">{label}</div>
      <div className="text-[28px] font-black text-brand">{value}</div>
    </div>
  );
}

function AttributionTab({ campaigns, cities, totals }: {
  campaigns: CampaignRow[]; cities: CityRow[];
  totals: { totalVisits: number; totalConv: number; totalRev: number; convRate: number };
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="ביקורים" value={totals.totalVisits.toLocaleString('he-IL')} />
        <Stat label="המרות" value={totals.totalConv.toLocaleString('he-IL')} />
        <Stat label="אחוז המרה" value={`${totals.convRate}%`} />
        <Stat label="הכנסה מיוחסת" value={money(totals.totalRev)} />
      </div>

      <div className={card}>
        <div className="text-[15px] font-bold mb-3">ROI לפי קמפיין</div>
        {campaigns.length === 0 ? (
          <p className="text-[14px] text-ink-secondary">אין עדיין נתוני ייחוס. חבר את `track-visitor` לאתר (UTM) ו-`payment-webhook` לספק התשלום.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-ink-secondary text-right border-b border-border">
                  <th className="py-2 font-semibold">קמפיין</th>
                  <th className="py-2 font-semibold">מקור</th>
                  <th className="py-2 font-semibold">ביקורים</th>
                  <th className="py-2 font-semibold">המרות</th>
                  <th className="py-2 font-semibold">אחוז</th>
                  <th className="py-2 font-semibold">הכנסה</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 font-semibold">{c.campaign}</td>
                    <td className="py-2 text-ink-secondary">{c.source}</td>
                    <td className="py-2">{c.visits.toLocaleString('he-IL')}</td>
                    <td className="py-2">{c.conversions}</td>
                    <td className="py-2">{c.visits ? Math.round((c.conversions / c.visits) * 100) : 0}%</td>
                    <td className="py-2 font-bold text-brand">{money(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cities.length > 0 && (
        <div className={card}>
          <div className="text-[15px] font-bold mb-3">ערים מובילות</div>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <span key={c.city} className="rounded-full bg-white/5 px-3 py-1 text-[13px] font-semibold">
                {c.city}: {c.visits.toLocaleString('he-IL')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SequencesTab({ sequences, emailLog }: { sequences: SequenceRow[]; emailLog: EmailLogRow[] }) {
  const [rows, setRows] = useState<SequenceRow[]>(sequences);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [enrollSeq, setEnrollSeq] = useState(sequences[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !subject.trim() || !body.trim()) return setMsg('צריך שם, נושא וגוף מייל.');
    setBusy(true); setMsg(null);
    const res = await createSequence({ name: name.trim(), steps: [{ delay_hours: 0, email_subject: subject.trim(), email_body: body.trim() }] });
    setBusy(false);
    if ('error' in res && res.error) return setMsg('שגיאה: ' + res.error);
    setRows((r) => [{ id: (res as { id: string }).id, name: name.trim(), status: 'active', steps: 1, activeEnrollments: 0 }, ...r]);
    setName(''); setSubject(''); setBody(''); setMsg('נוצר ✓');
  }

  async function toggle(id: string, status: string) {
    const next = status === 'active' ? 'paused' : 'active';
    setRows((r) => r.map((s) => (s.id === id ? { ...s, status: next } : s)));
    await setSequenceStatus(id, next as 'active' | 'paused');
  }

  async function enroll() {
    if (!enrollSeq || !enrollEmail.includes('@')) return setMsg('בחר רצף והכנס אימייל תקין.');
    setBusy(true); setMsg(null);
    const res = await enrollContact({ sequence_id: enrollSeq, email: enrollEmail.trim() });
    setBusy(false);
    if ('error' in res && res.error) return setMsg('שגיאה: ' + res.error);
    setRows((r) => r.map((s) => (s.id === enrollSeq ? { ...s, activeEnrollments: s.activeEnrollments + 1 } : s)));
    setEnrollEmail(''); setMsg('נרשם לרצף ✓');
  }

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="text-[15px] font-bold mb-3">רצף חדש (מייל ראשון)</div>
        <div className="space-y-2">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="שם הרצף (למשל: Welcome)" />
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="נושא — תומך {{first_name}}" />
          <textarea className={input + ' min-h-[110px]'} value={body} onChange={(e) => setBody(e.target.value)} placeholder="גוף המייל (HTML) — {{first_name}} / {{email}} / {{phone}}" />
          <button onClick={create} disabled={busy} className="bg-brand hover:bg-brand-hover text-bg font-bold px-5 py-2 rounded-lg disabled:opacity-50">
            {busy ? 'שומר…' : 'צור רצף'}
          </button>
        </div>
      </div>

      <div className={card}>
        <div className="text-[15px] font-bold mb-3">הרצפים שלי</div>
        {rows.length === 0 ? (
          <p className="text-[14px] text-ink-secondary">אין רצפים עדיין.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
                <div>
                  <div className="text-[14px] font-bold">{s.name}</div>
                  <div className="text-[12px] text-ink-secondary">{s.steps} שלבים · {s.activeEnrollments} פעילים · {s.status === 'active' ? 'פעיל' : 'מושהה'}</div>
                </div>
                <button onClick={() => toggle(s.id, s.status)} className="text-[13px] font-semibold rounded-lg bg-white/5 px-3 py-1.5 hover:bg-white/10">
                  {s.status === 'active' ? 'השהה' : 'הפעל'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <select className={input + ' max-w-[220px]'} value={enrollSeq} onChange={(e) => setEnrollSeq(e.target.value)}>
            <option value="">בחר רצף…</option>
            {rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className={input + ' max-w-[240px]'} dir="ltr" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} placeholder="email@example.com" />
          <button onClick={enroll} disabled={busy} className="bg-white/10 hover:bg-white/20 font-bold px-4 py-2 rounded-lg disabled:opacity-50">רשום לרצף</button>
        </div>
        {msg && <p className="text-[13px] mt-2 text-ink-secondary">{msg}</p>}
      </div>

      <div className={card}>
        <div className="text-[15px] font-bold mb-3">מיילים אחרונים ({emailLog.length})</div>
        {emailLog.length === 0 ? (
          <p className="text-[14px] text-ink-secondary">עדיין לא נשלחו מיילים.</p>
        ) : (
          <div className="space-y-1">
            {emailLog.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-border/50 py-1 text-[13px]">
                <span className="truncate" dir="ltr">{e.email_to}</span>
                <span className="truncate flex-1 text-ink-secondary px-2">{e.subject}</span>
                <span className="shrink-0 font-semibold">{e.clicked_at ? '🖱️ נלחץ' : e.opened_at ? '👁️ נפתח' : '✉️ נשלח'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
