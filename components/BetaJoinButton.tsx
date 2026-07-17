'use client';

import { MessageCircle } from 'lucide-react';

type Props = {
  productId: string;
  whatsappUrl: string;
  label: string;
  note?: string | null;
};

export default function BetaJoinButton({ productId, whatsappUrl, label, note }: Props) {
  function onClick() {
    // מדווח הקלקת בטא כאירוע המרה
    try {
      const payload = JSON.stringify({ productId, event: 'beta_click', surface: 'product' });
      const blob = new Blob([payload], { type: 'application/json' });
      if (!navigator.sendBeacon || !navigator.sendBeacon('/api/track', blob)) {
        fetch('/api/track', { method: 'POST', body: payload, keepalive: true });
      }
    } catch {
      // best-effort
    }
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="bg-soft border border-border rounded-2xl p-5">
      {note && <p className="text-ink-secondary text-[14px] mb-3">{note}</p>}
      <button
        onClick={onClick}
        className="cta-glow inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg font-bold px-6 py-3 rounded-[10px]"
      >
        <MessageCircle size={17} />
        {label}
      </button>
    </div>
  );
}
