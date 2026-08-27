'use client';

// Manage per-workspace channel connections (tokens/config) so distribution actually works.
// Channel list defined locally (don't import the server distribution module into the client).

import { useState } from 'react';
import { saveChannelConnection } from '@/app/actions-ops';

type Field = { key: string; label: string; list?: boolean; secret?: boolean };

const CHANNELS: { channel: string; fields: Field[]; help: string; notice?: string }[] = [
  {
    channel: 'טלגרם',
    help: 'צרו בוט אצל @BotFather, הדביקו את ה-token, ואת ה-chat id של הקבוצה/הערוץ.',
    fields: [
      { key: 'bot_token', label: 'Bot Token', secret: true },
      { key: 'chat_id', label: 'Chat ID' },
    ],
  },
  {
    channel: 'וואטסאפ',
    help: 'WhatsApp Cloud API — צריך Access Token, Phone Number ID, ורשימת נמענים.',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'phone_number_id', label: 'Phone Number ID' },
      { key: 'recipients', label: 'נמענים (מספרים, פסיק)', list: true },
    ],
  },
  {
    channel: 'מייל',
    help: 'שליחה דרך Resend (RESEND_API_KEY מוגדר בסביבה).',
    fields: [
      { key: 'from', label: 'שולח (from)' },
      { key: 'recipients', label: 'נמענים (מיילים, פסיק)', list: true },
      { key: 'subject', label: 'נושא' },
    ],
  },
  {
    channel: 'Discord',
    help: 'צרו Incoming Webhook בערוץ Discord והדביקו את ה-URL.',
    fields: [{ key: 'webhook_url', label: 'Webhook URL', secret: true }],
  },
  {
    channel: 'Slack',
    help: 'צרו Incoming Webhook ב-Slack והדביקו את ה-URL.',
    fields: [{ key: 'webhook_url', label: 'Webhook URL', secret: true }],
  },
  {
    channel: 'פייסבוק',
    help: 'Meta Graph API — Page ID + Page Access Token (דורש אפליקציית Meta + אישור פרסום).',
    fields: [
      { key: 'page_id', label: 'Page ID' },
      { key: 'access_token', label: 'Page Access Token', secret: true },
    ],
  },
  {
    channel: 'אינסטגרם',
    help: 'Meta Graph API — IG User ID + Token. פרסום דורש תמונה (image_url).',
    fields: [
      { key: 'ig_user_id', label: 'IG User ID' },
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'image_url', label: 'Image URL (חובה לפרסום)' },
    ],
  },
  {
    channel: 'לינקדאין',
    help: 'LinkedIn API — Author URN (urn:li:organization:… או urn:li:person:…) + Access Token.',
    fields: [
      { key: 'author_urn', label: 'Author URN' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
  {
    channel: 'X',
    help: 'X API v2 (בתשלום) — Bearer Token בהקשר משתמש (OAuth 2.0).',
    fields: [{ key: 'bearer_token', label: 'Bearer Token', secret: true }],
  },
  {
    channel: 'Mastodon',
    help: 'Instance URL + Access Token (מ-Preferences → Development).',
    fields: [
      { key: 'instance_url', label: 'Instance URL (למשל https://mastodon.social)' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
  {
    channel: 'Bluesky',
    help: 'Handle/DID + App Password (Settings → App Passwords).',
    fields: [
      { key: 'identifier', label: 'Handle או DID' },
      { key: 'app_password', label: 'App Password', secret: true },
    ],
  },
  {
    channel: 'Threads',
    help: 'Meta Threads API — Threads User ID + Access Token.',
    fields: [
      { key: 'threads_user_id', label: 'Threads User ID' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ],
  },
  {
    channel: 'Reddit',
    help: 'OAuth Access Token + subreddit (בלי /r/).',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'subreddit', label: 'Subreddit' },
      { key: 'title', label: 'כותרת (אופציונלי)' },
    ],
  },
  {
    channel: 'Dev.to',
    help: 'Forem API Key (Settings → Extensions → API Keys).',
    fields: [
      { key: 'api_key', label: 'API Key', secret: true },
      { key: 'title', label: 'כותרת (אופציונלי)' },
    ],
  },
  {
    channel: 'Medium',
    help: 'Integration Token + Author (User) ID.',
    fields: [
      { key: 'integration_token', label: 'Integration Token', secret: true },
      { key: 'author_id', label: 'Author ID' },
      { key: 'title', label: 'כותרת (אופציונלי)' },
    ],
  },
  {
    channel: 'WordPress',
    help: 'Site URL + שם משתמש + Application Password.',
    fields: [
      { key: 'site_url', label: 'Site URL' },
      { key: 'username', label: 'שם משתמש' },
      { key: 'app_password', label: 'Application Password', secret: true },
      { key: 'title', label: 'כותרת (אופציונלי)' },
    ],
  },
  {
    channel: 'Hashnode',
    help: 'Personal Access Token + Publication ID.',
    fields: [
      { key: 'api_key', label: 'API Token', secret: true },
      { key: 'publication_id', label: 'Publication ID' },
      { key: 'title', label: 'כותרת (אופציונלי)' },
    ],
  },
  {
    channel: 'Pinterest',
    help: 'Access Token + Board ID. פרסום Pin דורש תמונה (image_url).',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'board_id', label: 'Board ID' },
      { key: 'image_url', label: 'Image URL (חובה)' },
    ],
  },
  {
    channel: 'Google My Business',
    help: 'Access Token + Account ID + Location ID.',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'account_id', label: 'Account ID' },
      { key: 'location_id', label: 'Location ID' },
    ],
  },
  {
    channel: 'Warpcast',
    help: 'Farcaster דרך Neynar — API Key + Signer UUID.',
    fields: [
      { key: 'api_key', label: 'Neynar API Key', secret: true },
      { key: 'signer_uuid', label: 'Signer UUID' },
    ],
  },
  {
    channel: 'Lemmy',
    help: 'Instance URL + JWT + Community ID.',
    fields: [
      { key: 'instance_url', label: 'Instance URL' },
      { key: 'jwt', label: 'JWT', secret: true },
      { key: 'community_id', label: 'Community ID' },
      { key: 'title', label: 'כותרת (אופציונלי)' },
    ],
  },
  {
    channel: 'VK',
    help: 'Access Token + Owner ID (שלילי לקהילה).',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'owner_id', label: 'Owner ID' },
    ],
  },
  {
    channel: 'TikTok',
    help: 'Content Posting API — Access Token + Video URL (חובה וידאו).',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'video_url', label: 'Video URL' },
    ],
  },
  {
    channel: 'YouTube',
    help: 'YouTube Data API — Access Token + Video URL (הסרטון יועלה).',
    fields: [
      { key: 'access_token', label: 'Access Token', secret: true },
      { key: 'video_url', label: 'Video URL' },
    ],
  },
  {
    channel: 'DV360',
    help: 'Display & Video 360 — ה-DSP של גוגל לרכש פרוגרמטי במלאי פרימיום (כולל אתרי חדשות ישראליים דרך Deal ID: PMP / Programmatic Guaranteed / Preferred).',
    notice:
      'צריך חשבון DV360 פעיל לפני החיבור. DV360 אינו פתוח לרישום עצמי, הוא נפתח דרך שותף מוסמך של Google (Google Certified Partner) או מנהל חשבון. פתחו Advertiser תחת ה-Partner, קבלו Advertiser ID, ואז חברו כאן. עד שיש חשבון, ערוץ ה-DV360 יישאר לא פעיל.',
    fields: [
      { key: 'partner_id', label: 'Partner ID' },
      { key: 'advertiser_id', label: 'Advertiser ID' },
      { key: 'access_token', label: 'OAuth Access Token', secret: true },
    ],
  },
  {
    channel: 'Nostr',
    help: 'nsec (מפתח פרטי) + רשימת relays (מופרד בפסיק).',
    fields: [
      { key: 'nsec', label: 'nsec', secret: true },
      { key: 'relays', label: 'Relays (wss://…, מופרד בפסיק)' },
    ],
  },
];

type Conn = { channel: string; config: Record<string, unknown>; active: boolean };

const inputCls =
  'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand transition-colors';

function valueToStr(v: unknown, list?: boolean): string {
  if (v == null) return '';
  if (list && Array.isArray(v)) return v.join(', ');
  return String(v);
}

export default function ChannelConnections({ initial }: { initial: Conn[] }) {
  const byChannel = new Map(initial.map((c) => [c.channel, c]));

  return (
    <div className="flex flex-col gap-5">
      {CHANNELS.map((c) => (
        <ChannelCard
          key={c.channel}
          channel={c.channel}
          fields={c.fields}
          help={c.help}
          notice={c.notice}
          existing={byChannel.get(c.channel)}
        />
      ))}
    </div>
  );
}

function ChannelCard({
  channel,
  fields,
  help,
  notice,
  existing,
}: {
  channel: string;
  fields: Field[];
  help: string;
  notice?: string;
  existing?: Conn;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, valueToStr(existing?.config?.[f.key], f.list)]))
  );
  const [active, setActive] = useState(existing?.active ?? true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg('');
    const config: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = (values[f.key] ?? '').trim();
      config[f.key] = f.list ? raw.split(',').map((s) => s.trim()).filter(Boolean) : raw;
    }
    const res = await saveChannelConnection(channel, config, active);
    setBusy(false);
    setMsg(res?.error ? 'שגיאה בשמירה.' : 'נשמר ✓');
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-[16px]">{channel}</h3>
        <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          פעיל
        </label>
      </div>
      <p className="text-[13px] text-ink-muted mb-3">{help}</p>
      {notice && (
        <div
          role="note"
          className="flex gap-2 items-start bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-[10px] px-3 py-2.5 mb-3 text-[13px] leading-relaxed"
        >
          <span aria-hidden className="mt-[1px] shrink-0">⚠️</span>
          <span>{notice}</span>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">{f.label}</span>
            <input
              type={f.secret ? 'password' : 'text'}
              value={values[f.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              dir="ltr"
              className={inputCls}
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={busy}
          className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-semibold px-4 py-2 rounded-[10px] transition-colors"
        >
          {busy ? 'שומר…' : 'שמור'}
        </button>
        {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
      </div>
    </div>
  );
}
