'use client';

import { useState, useTransition } from 'react';
import { Code2, Key, Copy, Check, Send, Rocket, Loader2 } from 'lucide-react';
import { ensureContentApiToken, saveHeadlessConfig, publishHeadless, type HeadlessConfigForm } from '@/app/actions-developer';

type Recent = { id: string; title: string; slug: string; status: string; published_at: string | null };

export default function DeveloperApi({
  locale,
  token: initialToken,
  headlessConfig,
  recent,
}: {
  locale: string;
  token: string | null;
  headlessConfig: Record<string, string>;
  recent: Recent[];
}) {
  const he = locale !== 'en';
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(() => void fn());
  const [token, setToken] = useState<string | null>(initialToken);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pullUrl = token ? `${origin}/api/content?token=${token}` : `${origin}/api/content?token=…`;
  const pushUrl = `${origin}/api/publish`;

  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 py-8" dir={he ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 mb-1">
        <Code2 size={22} className="text-brand" />
        <h1 className="font-display font-black text-2xl md:text-3xl tracking-tight">Developer API</h1>
      </div>
      <p className="text-ink-secondary max-w-2xl text-[15px]">
        {he
          ? 'הזרם את התוכן שנוצר ב-OPS ישר לאתרי headless (Next.js / Astro / Vue / React) — Pull feed טיפוסי, revalidation אוטומטי ל-ISR, ו-push לכל CMS (WordPress / Wix / Webflow / webhook).'
          : 'Stream OPS content straight into headless sites (Next.js / Astro / Vue / React) — a typed Pull feed, on-demand ISR revalidation, and push to any CMS.'}
      </p>

      {/* API token */}
      <Section icon={<Key size={16} />} title={he ? 'מפתח API' : 'API key'}>
        {token ? (
          <TokenRow label={he ? 'מפתח' : 'Key'} value={token} />
        ) : (
          <button className={BTN} disabled={pending} onClick={() => run(async () => { const r = await ensureContentApiToken(); if ('token' in r && r.token) setToken(r.token); })}>
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />} {he ? 'צור מפתח' : 'Generate key'}
          </button>
        )}
        {token && <TokenRow label={he ? 'Pull feed' : 'Pull feed'} value={pullUrl} />}
      </Section>

      {/* Quickstart */}
      <Section icon={<Code2 size={16} />} title={he ? 'התחלה מהירה' : 'Quickstart'}>
        <p className="text-[13px] text-ink-secondary mb-2">{he ? 'משיכת התוכן באתר ה-headless שלך:' : 'Fetch content in your headless site:'}</p>
        <Code>{`// Next.js — ISR every 60s\nexport const revalidate = 60;\nconst res = await fetch("${origin}/api/content", {\n  headers: { "x-helix-api-key": "${token ?? 'YOUR_TOKEN'}" }\n});\nconst { items } = await res.json();`}</Code>
        <p className="text-[13px] text-ink-secondary mt-3 mb-2">{he ? 'דחיפת תוכן דרך ה-API (typed JSON):' : 'Push content via the API (typed JSON):'}</p>
        <Code>{`curl -X POST ${pushUrl} \\\n  -H "x-helix-api-key: ${token ?? 'YOUR_TOKEN'}" \\\n  -H "content-type: application/json" \\\n  -d '{"title":"שלום","html":"<p>...</p>","status":"published","external_id":"post-1"}'`}</Code>
      </Section>

      {/* Headless config: ISR revalidate + CMS */}
      <HeadlessConfig he={he} initial={headlessConfig} pending={pending} run={run} />

      {/* Publish a test item */}
      <PublishTest he={he} pending={pending} run={run} />

      {/* Recent */}
      <Section icon={<Send size={16} />} title={he ? 'תוכן אחרון בפיד' : 'Recent feed items'}>
        {recent.length === 0 ? (
          <p className="text-[13px] text-ink-secondary">{he ? 'עוד אין תוכן בפיד.' : 'No content in the feed yet.'}</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border border-border rounded-[10px] px-3 py-2 bg-soft/40">
                <div className="min-w-0"><span className="font-semibold">{r.title}</span> <span className="text-ink-secondary text-[12px]">/{r.slug}</span></div>
                <span className={`text-[11px] px-2 py-1 rounded-[8px] ${r.status === 'published' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-ink-secondary'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

const BTN = 'glow inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] disabled:opacity-60 active:scale-95 transition-all';
const GHOST = 'inline-flex items-center gap-2 border border-border hover:bg-soft text-ink-secondary hover:text-ink px-4 py-2 rounded-[10px] transition-colors';
const INPUT = 'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border border-border rounded-[14px] p-5 bg-soft/20">
      <h2 className="font-bold text-[15px] flex items-center gap-2 mb-3 text-brand">{icon} {title}</h2>
      {children}
    </section>
  );
}

function TokenRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-[12px] text-ink-secondary w-20 shrink-0">{label}</span>
      <code className="flex-1 bg-bg border border-border rounded-[8px] px-3 py-2 text-[12px] truncate font-mono">{value}</code>
      <button className={GHOST} onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="bg-bg border border-border rounded-[10px] p-3 text-[12px] overflow-x-auto font-mono whitespace-pre" dir="ltr">{children}</pre>;
}

function HeadlessConfig({ he, initial, pending, run }: { he: boolean; initial: Record<string, string>; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [f, setF] = useState<HeadlessConfigForm>({
    cms: (initial.cms as HeadlessConfigForm['cms']) || 'webhook',
    revalidate_url: initial.revalidate_url || '',
    revalidate_secret: initial.revalidate_secret || '',
    url: initial.url || '',
    base_url: initial.base_url || '',
    username: initial.username || '',
    app_password: initial.app_password || '',
    api_token: initial.api_token || '',
    site_id: initial.site_id || '',
    collection_id: initial.collection_id || '',
  });
  const [saved, setSaved] = useState(false);
  const set = (k: keyof HeadlessConfigForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = () => run(async () => { setSaved(false); const r = await saveHeadlessConfig(f); if (!('error' in r)) { setSaved(true); setTimeout(() => setSaved(false), 1500); } });

  return (
    <Section icon={<Rocket size={16} />} title={he ? 'חיבור אתר ה-headless (ISR + CMS)' : 'Connect your headless site (ISR + CMS)'}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="text-[12px] text-ink-secondary sm:col-span-2">{he ? 'Webhook ל-revalidation (ISR) — ייקרא בכל פרסום' : 'Revalidate webhook (ISR) — called on every publish'}</label>
        <input className={INPUT} placeholder="https://your-site.com/api/revalidate" value={f.revalidate_url ?? ''} onChange={set('revalidate_url')} />
        <input className={INPUT} placeholder={he ? 'סוד ל-revalidation (x-helix-secret)' : 'Revalidate secret (x-helix-secret)'} value={f.revalidate_secret ?? ''} onChange={set('revalidate_secret')} />
        <div className="sm:col-span-2 border-t border-border/60 my-1" />
        <label className="text-[12px] text-ink-secondary sm:col-span-2">{he ? 'דחיפה ל-CMS (אופציונלי)' : 'Push to a CMS (optional)'}</label>
        <select className={INPUT} value={f.cms} onChange={set('cms')}>
          {['webhook', 'wordpress', 'wix', 'webflow'].map((c) => <option key={c} value={c} className="bg-bg">{c}</option>)}
        </select>
        {f.cms === 'webhook' && <input className={INPUT} placeholder="Webhook URL" value={f.url ?? ''} onChange={set('url')} />}
        {f.cms === 'wordpress' && <>
          <input className={INPUT} placeholder="Base URL" value={f.base_url ?? ''} onChange={set('base_url')} />
          <input className={INPUT} placeholder="Username" value={f.username ?? ''} onChange={set('username')} />
          <input className={INPUT} placeholder="Application password" value={f.app_password ?? ''} onChange={set('app_password')} />
        </>}
        {(f.cms === 'wix' || f.cms === 'webflow') && <>
          <input className={INPUT} placeholder="API token" value={f.api_token ?? ''} onChange={set('api_token')} />
          {f.cms === 'wix' && <input className={INPUT} placeholder="Site ID" value={f.site_id ?? ''} onChange={set('site_id')} />}
          <input className={INPUT} placeholder="Collection ID" value={f.collection_id ?? ''} onChange={set('collection_id')} />
        </>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className={BTN} disabled={pending} onClick={save}>{saved ? <Check size={16} /> : <Rocket size={16} />} {he ? 'שמור חיבור' : 'Save connection'}</button>
      </div>
    </Section>
  );
}

function PublishTest({ he, pending, run }: { he: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [f, setF] = useState({ title: '', html: '', excerpt: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const submit = () => run(async () => {
    setMsg(null);
    const r = await publishHeadless({ title: f.title, html: f.html, excerpt: f.excerpt || undefined, status: 'published' });
    if (!('slug' in r)) setMsg(he ? 'שגיאה' : 'Error');
    else setMsg(he ? `פורסם /${r.slug}${r.revalidated ? ' · ISR רועננ' : ''}` : `Published /${r.slug}${r.revalidated ? ' · ISR revalidated' : ''}`);
  });
  return (
    <Section icon={<Send size={16} />} title={he ? 'פרסום לבדיקה' : 'Publish a test item'}>
      <div className="grid gap-2.5">
        <input className={INPUT} placeholder={he ? 'כותרת *' : 'Title *'} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <textarea className={`${INPUT} min-h-[90px]`} placeholder={he ? 'תוכן HTML *' : 'HTML content *'} value={f.html} onChange={(e) => setF({ ...f, html: e.target.value })} />
        <input className={INPUT} placeholder={he ? 'תקציר' : 'Excerpt'} value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className={BTN} disabled={pending || !f.title.trim() || !f.html.trim()} onClick={submit}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {he ? 'פרסם לפיד' : 'Publish to feed'}
        </button>
        {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
      </div>
    </Section>
  );
}
