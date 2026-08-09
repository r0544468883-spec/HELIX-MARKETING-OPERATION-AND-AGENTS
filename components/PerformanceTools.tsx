'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Wand2, Link2, FileText, MessageCircle, Loader2, Check, Copy } from 'lucide-react';
import { buildCampaign, learnStyle, setBranding, ensureReportToken, saveSettings } from '@/app/actions-performance';
import ContentDnaCard from '@/components/ContentDnaCard';
import PostBuilderCard from '@/components/PostBuilderCard';
import EmailWriterCard from '@/components/EmailWriterCard';

type Branding = { brand_name?: string; logo_url?: string; primary_color?: string; footer?: string };

const OAUTH = [
  { id: 'meta', label: 'Meta', channel: 'Meta' },
  { id: 'google', label: 'Google', channel: 'Google' },
  { id: 'tiktok', label: 'TikTok', channel: 'TikTok' },
] as const;

export default function PerformanceTools({
  locale,
  oauthPlatforms,
  connected,
  branding,
  reportToken,
  notifyWhatsapp,
  connectStatus,
}: {
  locale: string;
  oauthPlatforms: string[];
  connected: string[];
  branding: Branding;
  reportToken: string | null;
  notifyWhatsapp: boolean;
  connectStatus?: string;
}) {
  const he = locale !== 'en';
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(() => void fn());

  return (
    <div className="max-w-[1280px] mx-auto px-5 md:px-10 pt-8" dir={he ? 'rtl' : 'ltr'}>
      <div className="grid gap-4 md:grid-cols-2">
        <CampaignBuilder he={he} pending={pending} run={run} />
        <div className="grid gap-4">
          <ConnectAccounts he={he} oauthPlatforms={oauthPlatforms} connected={connected} status={connectStatus} />
          <StyleLearner he={he} pending={pending} run={run} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <ReportPanel he={he} branding={branding} reportToken={reportToken} pending={pending} run={run} />
        <WhatsAppPanel he={he} initial={notifyWhatsapp} connected={connected} pending={pending} run={run} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <ContentDnaCard he={he} />
        <PostBuilderCard he={he} />
      </div>
      <div className="mt-4">
        <EmailWriterCard he={he} />
      </div>
    </div>
  );
}

const CARD = 'border border-border rounded-[14px] p-5 bg-soft/30';
const INPUT = 'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand';
const BTN = 'glow inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-bg font-bold px-4 py-2 rounded-[10px] disabled:opacity-60 active:scale-95 transition-all';
const GHOST = 'inline-flex items-center gap-2 border border-border hover:bg-soft text-ink-secondary hover:text-ink px-4 py-2 rounded-[10px] transition-colors';

// ── AI campaign builder ──
function CampaignBuilder({ he, pending, run }: { he: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [f, setF] = useState({ platform: 'Meta', product: '', goal: '', objective: 'traffic', dailyBudget: '', audienceHint: '', link: '', variants: '3' });
  const [result, setResult] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = () =>
    run(async () => {
      setResult(null);
      const r = await buildCampaign({
        platform: f.platform,
        product: f.product,
        goal: f.goal || undefined,
        objective: f.objective as never,
        dailyBudget: f.dailyBudget ? Number(f.dailyBudget) : undefined,
        audienceHint: f.audienceHint || undefined,
        link: f.link || undefined,
        variants: Number(f.variants) || 3,
      });
      if (!('spec' in r)) setResult(he ? 'שגיאה: ' + r.error : 'Error: ' + r.error);
      else if (r.error) setResult(he ? 'שגיאה: ' + r.error : 'Error: ' + r.error);
      else setResult(
        he
          ? `נבנה קמפיין "${r.spec?.name}" · ${r.spec?.audiences.length} קהלים · ${r.creativeIds.length} וריאציות${r.created?.campaignId ? ' · עלה לפלטפורמה' : r.note ? ` · ${r.note}` : ''}`
          : `Built "${r.spec?.name}" · ${r.spec?.audiences.length} audiences · ${r.creativeIds.length} variants${r.created?.campaignId ? ' · pushed live' : r.note ? ` · ${r.note}` : ''}`
      );
    });

  return (
    <div className={CARD}>
      <h3 className="font-bold text-[15px] flex items-center gap-2 mb-1"><Wand2 size={16} className="text-brand" /> {he ? 'בניית קמפיין מאפס' : 'Build a campaign from scratch'}</h3>
      <p className="text-[13px] text-ink-secondary mb-4">{he ? 'בריף קצר → קהלים + וריאציות בסגנון שלך → נבנה PAUSED בפלטפורמה.' : 'Short brief → audiences + variants in your style → built PAUSED on the platform.'}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <select className={INPUT} value={f.platform} onChange={set('platform')}>
          {['Meta', 'TikTok', 'Google', 'Outbrain'].map((p) => <option key={p} value={p} className="bg-bg">{p}</option>)}
        </select>
        <select className={INPUT} value={f.objective} onChange={set('objective')}>
          {['traffic', 'leads', 'awareness', 'conversions', 'sales', 'engagement'].map((o) => <option key={o} value={o} className="bg-bg">{o}</option>)}
        </select>
        <input className={`${INPUT} sm:col-span-2`} placeholder={he ? 'מה מפרסמים? *' : 'What are you advertising? *'} value={f.product} onChange={set('product')} />
        <input className={`${INPUT} sm:col-span-2`} placeholder={he ? 'מטרה (למשל: לתאם דמו)' : 'Goal (e.g. book demos)'} value={f.goal} onChange={set('goal')} />
        <input className={INPUT} placeholder={he ? 'תקציב יומי ₪' : 'Daily budget ₪'} value={f.dailyBudget} onChange={set('dailyBudget')} />
        <input className={INPUT} placeholder={he ? 'מס׳ וריאציות' : 'Variants'} value={f.variants} onChange={set('variants')} />
        <input className={INPUT} placeholder={he ? 'רמז קהל' : 'Audience hint'} value={f.audienceHint} onChange={set('audienceHint')} />
        <input className={INPUT} placeholder={he ? 'קישור יעד' : 'Destination link'} value={f.link} onChange={set('link')} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className={BTN} disabled={pending || !f.product.trim()} onClick={submit}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {he ? 'בנה קמפיין' : 'Build'}
        </button>
        {result && <span className="text-[13px] text-ink-secondary">{result}</span>}
      </div>
    </div>
  );
}

// ── One-click OAuth account connect ──
function ConnectAccounts({ he, oauthPlatforms, connected, status }: { he: boolean; oauthPlatforms: string[]; connected: string[]; status?: string }) {
  return (
    <div className={CARD}>
      <h3 className="font-bold text-[15px] flex items-center gap-2 mb-1"><Link2 size={16} className="text-brand" /> {he ? 'חיבור חשבונות מדיה' : 'Connect ad accounts'}</h3>
      <p className="text-[13px] text-ink-secondary mb-3">{he ? 'התחברות בקליק (OAuth). ללא אפליקציה מאושרת — הזן טוקן ידנית בעמוד הערוצים.' : 'One-click OAuth. Without an approved app, paste a token in Channels.'}</p>
      {status && <div className="mb-3 text-[13px] px-3 py-2 rounded-[8px] bg-soft border border-border">{he ? 'סטטוס חיבור: ' : 'Connect status: '}<b>{status}</b></div>}
      <div className="flex flex-wrap gap-2">
        {OAUTH.map((p) => {
          const isConnected = connected.includes(p.channel);
          const hasApp = oauthPlatforms.includes(p.id);
          if (isConnected) return <span key={p.id} className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-[10px] bg-emerald-500/15 text-emerald-400"><Check size={14} /> {p.label}</span>;
          if (!hasApp) return <span key={p.id} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-2 rounded-[10px] border border-border text-ink-secondary opacity-70" title={he ? 'דורש אפליקציה מאושרת' : 'Requires approved app'}>{p.label} · {he ? 'ידני' : 'manual'}</span>;
          return <a key={p.id} href={`/api/oauth/${p.id}/start`} className={GHOST}>{he ? 'חבר' : 'Connect'} {p.label}</a>;
        })}
      </div>
    </div>
  );
}

// ── Style learning ──
function StyleLearner({ he, pending, run }: { he: boolean; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const submit = () =>
    run(async () => {
      const r = await learnStyle();
      if (!('profile' in r)) setMsg(he ? 'שגיאה' : 'Error');
      else setMsg(he ? `נלמד: ${r.profile.namingPattern} · תקציב ברירת מחדל ₪${r.profile.defaultDailyBudget}` : `Learned: ${r.profile.namingPattern}`);
    });
  return (
    <div className={CARD}>
      <h3 className="font-bold text-[15px] flex items-center gap-2 mb-1"><Sparkles size={16} className="text-brand" /> {he ? 'לימוד סגנון העבודה' : 'Learn your work style'}</h3>
      <p className="text-[13px] text-ink-secondary mb-3">{he ? 'לומד מהקמפיינים שלך: קונבנציית שמות, תקציבים, קהלים. מוחל אוטומטית על קמפיינים חדשים.' : 'Learns naming, budgets, audiences from your history and applies them to new campaigns.'}</p>
      <div className="flex items-center gap-3">
        <button className={BTN} disabled={pending} onClick={submit}>{pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {he ? 'למד סגנון' : 'Learn'}</button>
        {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
      </div>
    </div>
  );
}

// ── White-label report ──
function ReportPanel({ he, branding, reportToken, pending, run }: { he: boolean; branding: Branding; reportToken: string | null; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [b, setB] = useState<Branding>(branding);
  const [token, setToken] = useState<string | null>(reportToken);
  const [copied, setCopied] = useState(false);
  const set = (k: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value });
  const url = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/report/${token}` : null;

  const save = () => run(async () => { await setBranding(b); });
  const share = () => run(async () => { const r = await ensureReportToken(); if ('token' in r && r.token) setToken(r.token); });
  const copy = () => { if (url) { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <div className={CARD}>
      <h3 className="font-bold text-[15px] flex items-center gap-2 mb-1"><FileText size={16} className="text-brand" /> {he ? 'דוח White-Label ללקוח' : 'White-label client report'}</h3>
      <p className="text-[13px] text-ink-secondary mb-3">{he ? 'מיתוג הסוכנות שלך + קישור ציבורי לצפייה/הדפסה ל-PDF.' : 'Your agency branding + a public print-to-PDF link.'}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input className={INPUT} placeholder={he ? 'שם מותג' : 'Brand name'} value={b.brand_name ?? ''} onChange={set('brand_name')} />
        <input className={INPUT} placeholder={he ? 'קישור לוגו' : 'Logo URL'} value={b.logo_url ?? ''} onChange={set('logo_url')} />
        <input className={INPUT} placeholder={he ? 'צבע ראשי (#hex)' : 'Primary color (#hex)'} value={b.primary_color ?? ''} onChange={set('primary_color')} />
        <input className={INPUT} placeholder={he ? 'כיתוב תחתון' : 'Footer'} value={b.footer ?? ''} onChange={set('footer')} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={BTN} disabled={pending} onClick={save}>{he ? 'שמור מיתוג' : 'Save branding'}</button>
        <button className={GHOST} disabled={pending} onClick={share}>{he ? 'צור קישור דוח' : 'Create report link'}</button>
        {url && (
          <button className={GHOST} onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {he ? 'העתק' : 'Copy'}</button>
        )}
      </div>
      {url && <a href={url} target="_blank" rel="noreferrer" className="mt-2 block text-[12px] text-brand truncate">{url}</a>}
    </div>
  );
}

// ── WhatsApp activity updates ──
function WhatsAppPanel({ he, initial, connected, pending, run }: { he: boolean; initial: boolean; connected: string[]; pending: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [on, setOn] = useState(initial);
  const hasWa = connected.some((c) => ['וואטסאפ', 'whatsapp', 'WhatsApp'].includes(c));
  const toggle = () => run(async () => { const v = !on; setOn(v); await saveSettings({ notify_whatsapp: v }); });
  return (
    <div className={CARD}>
      <h3 className="font-bold text-[15px] flex items-center gap-2 mb-1"><MessageCircle size={16} className="text-brand" /> {he ? 'עדכוני WhatsApp' : 'WhatsApp updates'}</h3>
      <p className="text-[13px] text-ink-secondary mb-3">{he ? 'סיכום פעילות (השהיות/הגדלות/העלאות) נשלח לוואטסאפ אחרי כל ריצה.' : 'An activity summary is sent to WhatsApp after every run.'}</p>
      <label className="inline-flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={on} disabled={pending} onChange={toggle} className="w-4 h-4 accent-[color:var(--brand,#0ea5e9)]" />
        <span className="text-[14px] font-semibold">{he ? 'הפעל עדכוני WhatsApp' : 'Enable WhatsApp updates'}</span>
      </label>
      {!hasWa && <p className="mt-2 text-[12px] text-amber-400">{he ? 'טרם חובר חשבון וואטסאפ בעמוד הערוצים.' : 'No WhatsApp channel connected yet.'}</p>}
    </div>
  );
}
