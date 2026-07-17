'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCampaign, sendCampaign, saveTemplate, sendTestEmail } from '@/app/actions';
import type { Dict } from '@/lib/i18n/he';

type Product = { id: string; name: string };
type Template = { id: string; name: string; subject: string; body_html: string };

type Props = {
  locale: string;
  t: Dict['email'];
  isAdmin: boolean;
  products: Product[];
  templates: Template[];
  defaultFromEmail: string;
};

export default function CampaignComposer({ locale, t, isAdmin, products, templates, defaultFromEmail }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [fromName, setFromName] = useState('HELIX STAGE');
  const [fromEmail, setFromEmail] = useState(defaultFromEmail);
  const [segment, setSegment] = useState<'all' | 'product_waitlist' | 'my_contacts'>('my_contacts');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [localeFilter, setLocaleFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();

  const input =
    'w-full bg-surface border border-border rounded-[10px] px-4 py-2.5 text-[15px] outline-none focus:border-brand transition-colors';

  const STARTERS: Record<string, { subject: string; body: string }> = {
    welcome: {
      subject: t.starterWelcome,
      body: `<p>היי {{name}},</p>\n<p>תודה שנרשמתם! נשמח לעדכן אתכם בכל מה שחדש.</p>\n<p>בברכה,<br/>${fromName}</p>`,
    },
    launch: {
      subject: t.starterLaunch,
      body: `<p>היי {{name}},</p>\n<p>שמחים לבשר שהשקנו! <a href="https://helix-stage.vercel.app">קחו חלק כאן</a>.</p>\n<p>נתראה,<br/>${fromName}</p>`,
    },
    update: {
      subject: t.starterUpdate,
      body: `<p>היי {{name}},</p>\n<p>יש לנו עדכון מרגש לשתף אתכם...</p>\n<p>בברכה,<br/>${fromName}</p>`,
    },
  };

  function loadTemplate(id: string) {
    const tpl = templates.find((x) => x.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body_html);
    }
  }
  function loadStarter(key: string) {
    const s = STARTERS[key];
    if (s) {
      setSubject(s.subject);
      setBody(s.body);
    }
  }

  function buildInput() {
    return {
      subject,
      bodyHtml: body,
      fromName,
      fromEmail,
      segment,
      productId: segment === 'product_waitlist' ? productId : null,
      localeFilter: segment === 'all' ? localeFilter || null : null,
      tagFilter: segment === 'my_contacts' ? tagFilter.trim() || null : null,
      scheduledAt: null as string | null,
    };
  }

  function onSaveTemplate() {
    if (!templateName.trim() || !subject.trim() || !body.trim()) return;
    startTransition(async () => {
      await saveTemplate({ name: templateName, subject, bodyHtml: body });
      setTemplateName('');
      router.refresh();
    });
  }

  function onTest() {
    setErr('');
    setNote('');
    if (!subject.trim() || !body.trim()) return;
    startTransition(async () => {
      const res = await sendTestEmail(buildInput());
      if (res?.ok) setNote(t.testSent);
      else setErr(res?.error === 'noresend' ? t.errNoResend : t.errEmpty);
    });
  }

  function finishOk() {
    router.push(`/${locale}/dashboard/email`);
    router.refresh();
  }

  function onSchedule() {
    setErr('');
    if (!subject.trim() || !body.trim() || !scheduleAt) return;
    startTransition(async () => {
      const res = await createCampaign({ ...buildInput(), scheduledAt: new Date(scheduleAt).toISOString() });
      if (res?.ok) finishOk();
      else setErr(t.errEmpty);
    });
  }

  function onSend() {
    setErr('');
    if (!subject.trim() || !body.trim()) return;
    if (!confirm(t.confirmSend)) return;
    startTransition(async () => {
      const created = await createCampaign(buildInput());
      if (!created?.ok || !created.id) {
        setErr(t.errEmpty);
        return;
      }
      const res = await sendCampaign(created.id, locale);
      if (res?.ok) finishOk();
      else setErr(res?.error === 'noresend' ? t.errNoResend : res?.error === 'forbidden' ? t.errForbidden : t.errEmpty);
    });
  }

  const segBtn = (key: typeof segment, label: string) => (
    <button
      type="button"
      onClick={() => setSegment(key)}
      className={`flex-1 rounded-[10px] border p-3 text-start text-[14px] font-semibold transition-colors ${segment === key ? 'border-brand bg-brand/5 text-brand' : 'border-border bg-surface text-ink-secondary hover:border-border-strong'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 flex-wrap">
        {templates.length > 0 && (
          <select className={`${input} flex-1`} onChange={(e) => loadTemplate(e.target.value)} dir="auto" defaultValue="">
            <option value="">{t.loadTemplate}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </select>
        )}
        <select className={`${input} flex-1`} onChange={(e) => loadStarter(e.target.value)} dir="auto" defaultValue="">
          <option value="">{t.starter}</option>
          <option value="welcome">{t.starterWelcome}</option>
          <option value="launch">{t.starterLaunch}</option>
          <option value="update">{t.starterUpdate}</option>
        </select>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[14px]">{t.subject}</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} dir="auto" className={input} />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[14px]">{t.body}</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} dir="auto" className={`${input} resize-y font-mono text-[13px]`} />
        <span className="text-[13px] text-ink-muted">{t.bodyHint}</span>
        <span className="text-[13px] text-brand">{t.personalizeHint}</span>
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.fromName}</span>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} dir="auto" className={input} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.fromEmail}</span>
          <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="news@helix.co.il" dir="ltr" className={input} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-[14px]">{t.segment}</span>
        <div className="flex flex-col sm:flex-row gap-3">
          {segBtn('my_contacts', t.segContacts)}
          {segBtn('product_waitlist', t.segWaitlist)}
          {isAdmin && segBtn('all', t.segAll)}
        </div>
      </div>

      {segment === 'my_contacts' && (
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.tagFilter}</span>
          <input value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} dir="auto" className={input} />
        </label>
      )}
      {segment === 'product_waitlist' && products.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.pickProduct}</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={input} dir="auto">
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}
      {segment === 'all' && (
        <label className="flex flex-col gap-2">
          <span className="font-semibold text-[14px]">{t.localeAll}</span>
          <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} className={input} dir="auto">
            <option value="">{t.localeAll}</option>
            <option value="he">{t.localeHe}</option>
            <option value="en">{t.localeEn}</option>
          </select>
        </label>
      )}

      <label className="flex flex-col gap-2">
        <span className="font-semibold text-[14px]">{t.scheduleAt}</span>
        <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} dir="ltr" className={`${input} max-w-xs`} />
      </label>

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <label className="flex flex-col gap-2 flex-1">
          <span className="font-semibold text-[13px] text-ink-secondary">{t.templateName}</span>
          <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} dir="auto" className={input} />
        </label>
        <button type="button" onClick={onSaveTemplate} disabled={isPending || !templateName.trim()} className="border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-4 py-2.5 text-[14px] font-semibold transition-colors">
          {t.saveTemplate}
        </button>
      </div>

      {err && <p className="text-red-400 text-[14px] font-semibold">{err}</p>}
      {note && <p className="text-brand text-[14px] font-semibold">{note}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={onTest} disabled={isPending || !subject.trim() || !body.trim()} className="border border-border hover:border-brand text-ink-secondary hover:text-ink rounded-[10px] px-5 py-3 text-[15px] font-semibold transition-colors">
          {t.testSend}
        </button>
        {scheduleAt && (
          <button type="button" onClick={onSchedule} disabled={isPending} className="border border-brand/40 bg-brand/5 hover:bg-brand/10 text-brand rounded-[10px] px-5 py-3 font-bold transition-colors">
            {t.schedule}
          </button>
        )}
        <button type="button" onClick={onSend} disabled={isPending || !subject.trim() || !body.trim()} className="cta-glow bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-6 py-3 rounded-[10px]">
          {isPending ? t.sending : t.send}
        </button>
      </div>
    </div>
  );
}
