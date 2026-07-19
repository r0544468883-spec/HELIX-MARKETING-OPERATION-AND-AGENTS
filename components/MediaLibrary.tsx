'use client';

import { useState } from 'react';
import { createClientProfile, registerMediaAsset } from '@/app/actions-media';

export type ClientRow = { id: string; name: string };
export type AssetRow = {
  id: string;
  asset_ref: string;
  title: string | null;
  topic: string | null;
  target_networks: string[];
  status: string;
};

const input =
  'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none focus:border-black/30';
const label = 'block text-[13px] font-semibold mb-1';
const NETWORKS = ['אינסטגרם', 'פייסבוק', 'לינקדאין', 'טלגרם', 'TikTok', 'X'];

export default function MediaLibrary({ clients, assets }: { clients: ClientRow[]; assets: AssetRow[] }) {
  const [clientRows, setClientRows] = useState<ClientRow[]>(clients);
  const [assetRows, setAssetRows] = useState<AssetRow[]>(assets);
  const [msg, setMsg] = useState<string | null>(null);

  // Client profile form
  const [cName, setCName] = useState('');
  const [cAudience, setCAudience] = useState('');
  const [cVoice, setCVoice] = useState('');

  // Asset form
  const [clientId, setClientId] = useState('');
  const [ref, setRef] = useState('');
  const [topic, setTopic] = useState('');
  const [desc, setDesc] = useState('');
  const [nets, setNets] = useState<string[]>(['אינסטגרם']);

  function toggleNet(n: string) {
    setNets((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  }

  async function saveClient() {
    if (!cName.trim()) return setMsg('צריך שם לקוח.');
    const res = await createClientProfile({ name: cName.trim(), audience: cAudience, voice: cVoice });
    if ('error' in res && res.error) return setMsg('שגיאה: ' + res.error);
    setClientRows((r) => [...r, { id: crypto.randomUUID(), name: cName.trim() }]);
    setCName('');
    setCAudience('');
    setCVoice('');
    setMsg('פרופיל לקוח נוצר ✓');
  }

  async function saveAsset() {
    if (!ref.trim()) return setMsg('צריך מזהה נכס (asset ref).');
    if (nets.length === 0) return setMsg('בחרו לפחות רשת אחת.');
    const res = await registerMediaAsset({
      client_id: clientId || undefined,
      asset_ref: ref.trim(),
      topic: topic.trim() || undefined,
      description: desc.trim() || undefined,
      target_networks: nets,
    });
    if ('error' in res && res.error) return setMsg('שגיאה: ' + res.error);
    setAssetRows((r) => [
      { id: crypto.randomUUID(), asset_ref: ref.trim(), title: null, topic: topic.trim() || null, target_networks: nets, status: 'new' },
      ...r,
    ]);
    setRef('');
    setTopic('');
    setDesc('');
    setMsg('נכס נרשם ✓ הסוכן יכתוב כיתוב ויתזמן.');
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-black/10 p-5 space-y-4">
        <h2 className="font-display text-[18px] font-bold">פרופיל לקוח</h2>
        <div className="grid grid-cols-3 gap-3">
          <input className={input} value={cName} onChange={(e) => setCName(e.target.value)} placeholder="שם לקוח" />
          <input className={input} value={cAudience} onChange={(e) => setCAudience(e.target.value)} placeholder="קהל יעד" />
          <input className={input} value={cVoice} onChange={(e) => setCVoice(e.target.value)} placeholder="טון/סגנון" />
        </div>
        <button onClick={saveClient} className="rounded-lg bg-black/5 text-ink-secondary px-4 py-2 text-[14px] font-semibold">
          הוסף לקוח
        </button>
      </section>

      <section className="rounded-xl border border-black/10 p-5 space-y-4">
        <h2 className="font-display text-[18px] font-bold">נכס מדיה חדש</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>לקוח</label>
            <select className={input} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">— ללא —</option>
              {clientRows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>מזהה נכס (ייחודי)</label>
            <input className={input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="בלדיגה-27072026-חוק-השנץ" />
          </div>
        </div>
        <div>
          <label className={label}>נושא</label>
          <input className={input} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="סרטון בנושא חוק השנץ" />
        </div>
        <div>
          <label className={label}>תיאור המדיה (מקור לכיתוב)</label>
          <textarea className={input + ' min-h-[64px]'} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <label className={label}>רשתות יעד</label>
          <div className="flex flex-wrap gap-2">
            {NETWORKS.map((n) => (
              <button key={n} type="button" onClick={() => toggleNet(n)} className={'rounded-full px-3 py-1 text-[13px] font-semibold ' + (nets.includes(n) ? 'bg-black text-white' : 'bg-black/5 text-ink-secondary')}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveAsset} className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold">
            רשום נכס
          </button>
          {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[18px] font-bold mb-4">נכסים</h2>
        <div className="space-y-2">
          {assetRows.length === 0 && <p className="text-ink-secondary text-[14px]">עוד אין נכסים.</p>}
          {assetRows.map((a) => (
            <div key={a.id} className="rounded-lg border border-black/10 p-3 flex items-center justify-between">
              <div className="text-[14px] min-w-0">
                <span className="font-semibold">{a.asset_ref}</span>{' '}
                <span className="text-ink-secondary">· {a.topic ?? ''} · {a.target_networks.join('/')}</span>
              </div>
              <span className="shrink-0 rounded-full bg-black/5 text-ink-secondary px-3 py-1 text-[12px] font-semibold">{a.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
