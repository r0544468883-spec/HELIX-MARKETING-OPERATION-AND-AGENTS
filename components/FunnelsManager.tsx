'use client';

import { useState } from 'react';
import { createFunnel, setFunnelActive } from '@/app/actions-engagement';

export type FunnelRow = {
  id: string;
  channel: string;
  keyword: string;
  public_reply_text: string;
  dm_message: string;
  tier: 'compliant' | 'risk';
  active: boolean;
};

const CHANNELS = ['פייסבוק', 'אינסטגרם'];

const input =
  'w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none focus:border-black/30';
const label = 'block text-[13px] font-semibold mb-1';

export default function FunnelsManager({ initial }: { initial: FunnelRow[] }) {
  const [rows, setRows] = useState<FunnelRow[]>(initial);
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [keyword, setKeyword] = useState('');
  const [postId, setPostId] = useState('');
  const [publicReply, setPublicReply] = useState('שלחנו לך הודעה בפרטי 📩');
  const [dm, setDm] = useState('היי {{שם}} 👋 הנה הפרטים שביקשת: {{לינק}}');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!keyword.trim() || !dm.trim()) {
      setMsg('צריך מילת טריגר והודעה פרטית.');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await createFunnel({
      channel,
      keyword: keyword.trim(),
      post_id: postId.trim() || undefined,
      public_reply_text: publicReply,
      dm_message: dm,
      tier: 'compliant',
    });
    setBusy(false);
    if ('error' in res && res.error) {
      setMsg('שגיאה: ' + res.error);
      return;
    }
    setRows((r) => [
      {
        id: crypto.randomUUID(),
        channel,
        keyword: keyword.trim(),
        public_reply_text: publicReply,
        dm_message: dm,
        tier: 'compliant',
        active: true,
      },
      ...r,
    ]);
    setKeyword('');
    setPostId('');
    setMsg('נוצר ✓');
  }

  async function toggle(id: string, active: boolean) {
    setRows((r) => r.map((f) => (f.id === id ? { ...f, active } : f)));
    await setFunnelActive(id, active);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-black/10 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>ערוץ</label>
            <select className={input} value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>מילת טריגר</label>
            <input className={input} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="מדריך" />
          </div>
        </div>
        <div>
          <label className={label}>Post ID (אופציונלי — ריק = כל הפוסטים)</label>
          <input className={input} value={postId} onChange={(e) => setPostId(e.target.value)} />
        </div>
        <div>
          <label className={label}>תגובה פומבית</label>
          <input className={input} value={publicReply} onChange={(e) => setPublicReply(e.target.value)} />
        </div>
        <div>
          <label className={label}>הודעה פרטית (DM) — תומך משתנים כמו {'{{שם}}'}</label>
          <textarea className={input + ' min-h-[80px]'} value={dm} onChange={(e) => setDm(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-black text-white px-4 py-2 text-[14px] font-semibold disabled:opacity-50"
          >
            {busy ? 'יוצר…' : 'צור funnel'}
          </button>
          {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <p className="text-ink-secondary text-[14px]">עוד אין funnels.</p>}
        {rows.map((f) => (
          <div key={f.id} className="rounded-lg border border-black/10 p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">
                {f.channel} · טריגר: “{f.keyword}”
              </div>
              <div className="text-[13px] text-ink-secondary truncate mt-1">DM: {f.dm_message}</div>
            </div>
            <button
              onClick={() => toggle(f.id, !f.active)}
              className={
                'shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold ' +
                (f.active ? 'bg-emerald-100 text-emerald-800' : 'bg-black/5 text-ink-secondary')
              }
            >
              {f.active ? 'פעיל' : 'כבוי'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
