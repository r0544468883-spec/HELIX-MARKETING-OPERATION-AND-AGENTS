// ערוצי preset למחולל הלינקים ולפילוח
export const CHANNELS: { key: string; label: string }[] = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'google', label: 'Google' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'x', label: 'X / Twitter' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'email', label: 'Email' },
  { key: 'producthunt', label: 'Product Hunt' },
];

const HOST_MAP: { match: string; source: string }[] = [
  { match: 'linkedin.', source: 'linkedin' },
  { match: 'lnkd.in', source: 'linkedin' },
  { match: 'google.', source: 'google' },
  { match: 'facebook.', source: 'facebook' },
  { match: 'fb.', source: 'facebook' },
  { match: 't.co', source: 'x' },
  { match: 'x.com', source: 'x' },
  { match: 'twitter.', source: 'x' },
  { match: 'whatsapp', source: 'whatsapp' },
  { match: 'wa.me', source: 'whatsapp' },
  { match: 'instagram.', source: 'instagram' },
  { match: 'producthunt.', source: 'producthunt' },
];

/** ניקוי ושיוך source לערוץ מוכר */
export function normalizeSource(raw: string | null | undefined, referrer?: string | null): string {
  const val = (raw ?? '').trim().toLowerCase();
  if (val) {
    const known = CHANNELS.find((c) => c.key === val);
    if (known) return known.key;
    // ערך חופשי מ-?ref= / utm_source — משאירים כפי שהוא (מקוצר)
    return val.replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'other';
  }
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase();
      const hit = HOST_MAP.find((h) => host.includes(h.match));
      if (hit) return hit.source;
      if (host) return 'other';
    } catch {
      // referrer לא תקין
    }
  }
  return 'direct';
}

export function channelLabel(source: string): string {
  const c = CHANNELS.find((x) => x.key === source);
  if (c) return c.label;
  if (source === 'direct') return 'Direct';
  if (source === 'other') return 'Other';
  return source;
}
