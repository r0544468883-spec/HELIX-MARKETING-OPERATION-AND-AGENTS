'use client';

// Link a WhatsApp number to the workspace so the HELIX OPS operator bot answers
// on WhatsApp with THIS workspace's data (same bot_links mechanism as Telegram).
import { useState } from 'react';
import { linkWhatsApp } from '@/app/actions-ops';

export default function BotWhatsAppLink({ initial }: { initial?: string }) {
  const [phone, setPhone] = useState(initial ?? '');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    setMsg('');
    const res = await linkWhatsApp(phone);
    setBusy(false);
    if (res?.error) {
      setMsg(res.error === 'invalid_phone' ? 'מספר לא תקין.' : 'שגיאה בקישור.');
    } else {
      setMsg(`מקושר ✓ (${res?.identifier})`);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5" dir="rtl">
      <h3 className="font-bold text-[16px] mb-1">קישור וואטסאפ לבוט</h3>
      <p className="text-[13px] text-ink-muted mb-3">
        קשרו את מספר הוואטסאפ שלכם כדי שהבוט יענה עם הנתונים של סביבת העבודה הזו. הזינו מספר
        בינלאומי מלא (למשל 972501234567). דורש שהערוץ וואטסאפ למעלה יהיה מוגדר.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="972501234567"
          dir="ltr"
          className="flex-1 bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand transition-colors"
        />
        <button
          onClick={link}
          disabled={busy}
          className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-semibold px-4 py-2 rounded-[10px] transition-colors shrink-0"
        >
          {busy ? 'מקשר…' : 'קשר'}
        </button>
      </div>
      {msg && <span className="block mt-3 text-[13px] text-ink-secondary">{msg}</span>}
    </div>
  );
}
