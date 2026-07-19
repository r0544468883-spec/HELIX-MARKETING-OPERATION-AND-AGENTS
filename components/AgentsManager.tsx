'use client';

import { useState } from 'react';
import { createAgent, setAgentActive, setOllamaEndpoint } from '@/app/actions-agentos';

export type AgentRow = {
  id: string;
  name: string;
  type: string;
  model_tier: 'local' | 'quality' | 'auto';
  config: { prompt?: string; channels?: string[] };
  active: boolean;
};

export type OllamaRow = { mode: 'shared' | 'local'; base_url: string; model: string };

const input =
  'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none focus:border-black/30';
const label = 'block text-[13px] font-semibold mb-1';
const CHANNELS = ['טלגרם', 'וואטסאפ', 'מייל'];
const TIERS: { v: AgentRow['model_tier']; l: string }[] = [
  { v: 'auto', l: 'אוטומטי' },
  { v: 'local', l: 'Ollama (מקומי)' },
  { v: 'quality', l: 'Claude (איכות)' },
];

export default function AgentsManager({ agents, ollama }: { agents: AgentRow[]; ollama: OllamaRow | null }) {
  const [rows, setRows] = useState<AgentRow[]>(agents);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [tier, setTier] = useState<AgentRow['model_tier']>('auto');
  const [channels, setChannels] = useState<string[]>(['טלגרם']);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Ollama endpoint form
  const [oMode, setOMode] = useState<OllamaRow['mode']>(ollama?.mode ?? 'shared');
  const [oUrl, setOUrl] = useState(ollama?.base_url ?? '');
  const [oModel, setOModel] = useState(ollama?.model ?? 'qwen3.5:4b');
  const [oMsg, setOMsg] = useState<string | null>(null);

  function toggleChannel(c: string) {
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  async function submit() {
    if (!name.trim() || !prompt.trim()) {
      setMsg('צריך שם ופרומפט.');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await createAgent({ name: name.trim(), prompt: prompt.trim(), channels, model_tier: tier });
    setBusy(false);
    if ('error' in res && res.error) {
      setMsg('שגיאה: ' + res.error);
      return;
    }
    setRows((r) => [
      { id: crypto.randomUUID(), name: name.trim(), type: 'prompt', model_tier: tier, config: { prompt: prompt.trim(), channels }, active: true },
      ...r,
    ]);
    setName('');
    setPrompt('');
    setMsg('סוכן נוצר ✓');
  }

  async function toggle(id: string, active: boolean) {
    setRows((r) => r.map((a) => (a.id === id ? { ...a, active } : a)));
    await setAgentActive(id, active);
  }

  async function saveOllama() {
    if (!oUrl.trim()) {
      setOMsg('צריך base URL.');
      return;
    }
    const res = await setOllamaEndpoint({ mode: oMode, base_url: oUrl.trim(), model: oModel.trim() });
    setOMsg('error' in res && res.error ? 'שגיאה: ' + res.error : 'נשמר ✓');
  }

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-black/10 p-5 space-y-4">
        <h2 className="font-display text-[18px] font-bold">סוכן חדש</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>שם (כותרת בדייג'סט)</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="חדשות בתחום" />
          </div>
          <div>
            <label className={label}>מודל</label>
            <select className={input} value={tier} onChange={(e) => setTier(e.target.value as AgentRow['model_tier'])}>
              {TIERS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>מה הסוכן יעשה (פרומפט)</label>
          <textarea className={input + ' min-h-[70px]'} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="סכם 3 חדשות AI חשובות מהיום, נקודה לכל אחת." />
        </div>
        <div>
          <label className={label}>ערוצי דייג'סט</label>
          <div className="flex gap-2">
            {CHANNELS.map((c) => (
              <button key={c} type="button" onClick={() => toggleChannel(c)} className={'rounded-full px-3 py-1 text-[13px] font-semibold ' + (channels.includes(c) ? 'bg-black text-white' : 'bg-black/5 text-ink-secondary')}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={busy} className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold disabled:opacity-50">
            {busy ? 'יוצר…' : 'צור סוכן'}
          </button>
          {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
        </div>
      </section>

      <section>
        <h2 className="font-display text-[18px] font-bold mb-4">הסוכנים שלי</h2>
        <div className="space-y-2">
          {rows.length === 0 && <p className="text-ink-secondary text-[14px]">עוד אין סוכנים.</p>}
          {rows.map((a) => (
            <div key={a.id} className="rounded-lg border border-black/10 p-3 flex items-center justify-between">
              <div className="text-[14px] min-w-0">
                <span className="font-semibold">{a.name}</span>{' '}
                <span className="text-ink-secondary">· {a.model_tier} · {(a.config.channels ?? []).join('/')}</span>
              </div>
              <button onClick={() => toggle(a.id, !a.active)} className={'rounded-full px-3 py-1 text-[12px] font-semibold ' + (a.active ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-ink-secondary')}>
                {a.active ? 'פעיל' : 'כבוי'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 p-5 space-y-4">
        <h2 className="font-display text-[18px] font-bold">חיבור Ollama</h2>
        <p className="text-ink-secondary text-[13px]">מנוהל = השרת שלנו · מקומי = ה-Ollama שלכם (פרטיות מלאה).</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>מצב</label>
            <select className={input} value={oMode} onChange={(e) => setOMode(e.target.value as OllamaRow['mode'])}>
              <option value="shared">מנוהל (HELIX)</option>
              <option value="local">מקומי (שלי)</option>
            </select>
          </div>
          <div>
            <label className={label}>מודל</label>
            <input className={input} value={oModel} onChange={(e) => setOModel(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={label}>Base URL</label>
          <input className={input} value={oUrl} onChange={(e) => setOUrl(e.target.value)} placeholder="http://localhost:11434" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveOllama} className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold">
            שמור חיבור
          </button>
          {oMsg && <span className="text-[13px] text-ink-secondary">{oMsg}</span>}
        </div>
      </section>
    </div>
  );
}
