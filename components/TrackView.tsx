'use client';

import { useEffect } from 'react';

type Props = {
  productId: string;
  surface: 'product' | 'landing';
};

// רישום צפייה פעם אחת פר-session. מזהה source מ-?ref= / utm_source / referrer.
export default function TrackView({ productId, surface }: Props) {
  useEffect(() => {
    const guardKey = `hv_${surface}_${productId}`;
    try {
      if (sessionStorage.getItem(guardKey)) return;
      sessionStorage.setItem(guardKey, '1');
    } catch {
      // sessionStorage לא זמין — עדיין נרשום פעם אחת
    }

    const params = new URLSearchParams(window.location.search);
    const source = params.get('ref') || params.get('utm_source') || '';

    let sessionHash = '';
    try {
      sessionHash = sessionStorage.getItem('hv_sid') || '';
      if (!sessionHash) {
        sessionHash = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem('hv_sid', sessionHash);
      }
    } catch {
      // ignore
    }

    const payload = JSON.stringify({
      productId,
      event: 'view',
      surface,
      source,
      referrer: document.referrer || '',
      sessionHash,
    });

    try {
      const blob = new Blob([payload], { type: 'application/json' });
      if (!navigator.sendBeacon || !navigator.sendBeacon('/api/track', blob)) {
        fetch('/api/track', { method: 'POST', body: payload, keepalive: true });
      }
    } catch {
      fetch('/api/track', { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
  }, [productId, surface]);

  return null;
}
