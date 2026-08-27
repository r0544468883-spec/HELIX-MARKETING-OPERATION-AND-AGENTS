'use client';

// Managed-lane pipeline: publisher deals as a kanban across stages, with a create form.
// Deals with no API (direct IO with Ynet/Walla/…) live entirely here until, if programmatic,
// they get a Deal ID and move to DV360 for automated delivery.

import { useState, useTransition } from 'react';
import {
  createPublisherDeal,
  setDealStage,
  DEAL_STAGES,
  type PublisherDeal,
  type DealStage,
  type NewDealInput,
} from '@/app/actions-media-buying';

const STAGE_LABEL: Record<DealStage, string> = {
  proposed: 'הצעה',
  negotiating: 'מו״מ',
  approved: 'אושר',
  live: 'לייב',
  ended: 'הסתיים',
};

const DEAL_TYPE_LABEL: Record<PublisherDeal['deal_type'], string> = {
  io: 'IO (דיל ישיר)',
  pmp: 'PMP',
  pg: 'Programmatic Guaranteed',
  preferred: 'Preferred Deal',
};

const inputCls =
  'w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand transition-colors';

function nis(n: number): string {
  return new Intl.NumberFormat('he-IL').format(n);
}

export default function PublisherDealsPipeline({ initial }: { initial: PublisherDeal[] }) {
  const [deals, setDeals] = useState<PublisherDeal[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  const byStage = (stage: DealStage) => deals.filter((d) => d.stage === stage);

  function move(id: string, stage: DealStage) {
    // optimistic
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stage } : d)));
    startTransition(async () => {
      await setDealStage(id, stage);
    });
  }

  async function onCreate(input: NewDealInput) {
    const res = await createPublisherDeal(input);
    if (res?.ok) {
      // reflect immediately with a temp row; a refresh/navigation will reconcile from the server
      setDeals((ds) => [
        {
          id: `tmp-${ds.length}-${input.publisher}`,
          publisher: input.publisher,
          stage: 'proposed',
          deal_type: input.deal_type ?? 'io',
          unit: input.unit ?? 'cpm',
          rate: input.rate ?? 0,
          guaranteed_impressions: input.guaranteed_impressions ?? 0,
          deal_id: null,
          deadline: input.deadline ?? null,
          contact_name: input.contact_name ?? null,
          contact_email: input.contact_email ?? null,
          invoice_status: 'none',
          notes: input.notes ?? null,
          client_id: input.client_id ?? null,
          created_at: '',
        },
        ...ds,
      ]);
      setShowForm(false);
    }
    return res;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink-muted">{deals.length} דילים</span>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-brand hover:bg-brand-hover text-bg font-semibold px-4 py-2 rounded-[10px] transition-colors text-[14px]"
        >
          {showForm ? 'סגור' : '+ דיל חדש'}
        </button>
      </div>

      {showForm && <DealForm onCreate={onCreate} busy={pending} />}

      {deals.length === 0 && !showForm ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-ink-muted text-[14px]">
          אין עדיין דילים. פתחו דיל ראשון מול פאבלישר עם הכפתור למעלה.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-5 grid-cols-1 items-start">
          {DEAL_STAGES.map((stage) => (
            <div key={stage} className="bg-surface border border-border rounded-xl p-3 min-h-[120px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-bold text-[14px]">{STAGE_LABEL[stage]}</h3>
                <span className="text-[12px] text-ink-muted tabular-nums">{byStage(stage).length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {byStage(stage).map((d) => (
                  <DealCard key={d.id} deal={d} onMove={move} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DealCard({ deal, onMove }: { deal: PublisherDeal; onMove: (id: string, s: DealStage) => void }) {
  const idx = DEAL_STAGES.indexOf(deal.stage);
  const prev = idx > 0 ? DEAL_STAGES[idx - 1] : null;
  const next = idx < DEAL_STAGES.length - 1 ? DEAL_STAGES[idx + 1] : null;
  const isTmp = deal.id.startsWith('tmp-');

  return (
    <div className="bg-bg border border-border rounded-[10px] p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-[14px]">{deal.publisher}</span>
        {deal.deal_id ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Deal ID
          </span>
        ) : null}
      </div>
      <p className="text-[12px] text-ink-muted mb-1">{DEAL_TYPE_LABEL[deal.deal_type]}</p>
      <p className="text-[12px] text-ink-secondary tabular-nums">
        {deal.rate ? `${deal.unit.toUpperCase()} ₪${nis(deal.rate)}` : '—'}
        {deal.guaranteed_impressions ? ` · ${nis(deal.guaranteed_impressions)} חשיפות` : ''}
      </p>
      {deal.deadline && (
        <p className="text-[11px] text-ink-muted mt-1">עד {deal.deadline}</p>
      )}
      {!isTmp && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {prev && (
            <button
              onClick={() => onMove(deal.id, prev)}
              className="text-[11px] border border-border rounded px-2 py-1 hover:border-brand transition-colors"
              aria-label={`החזר ל${STAGE_LABEL[prev]}`}
            >
              ← {STAGE_LABEL[prev]}
            </button>
          )}
          {next && (
            <button
              onClick={() => onMove(deal.id, next)}
              className="text-[11px] bg-brand/10 text-brand rounded px-2 py-1 hover:bg-brand/20 transition-colors"
              aria-label={`קדם ל${STAGE_LABEL[next]}`}
            >
              {STAGE_LABEL[next]} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DealForm({
  onCreate,
  busy,
}: {
  onCreate: (input: NewDealInput) => Promise<{ ok?: boolean; error?: string } | undefined>;
  busy: boolean;
}) {
  const [publisher, setPublisher] = useState('');
  const [dealType, setDealType] = useState<PublisherDeal['deal_type']>('io');
  const [unit, setUnit] = useState<PublisherDeal['unit']>('cpm');
  const [rate, setRate] = useState('');
  const [impressions, setImpressions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [contact, setContact] = useState('');
  const [msg, setMsg] = useState('');

  async function submit() {
    setMsg('');
    if (!publisher.trim()) {
      setMsg('שם פאבלישר חובה.');
      return;
    }
    const res = await onCreate({
      publisher: publisher.trim(),
      deal_type: dealType,
      unit,
      rate: rate ? Number(rate) : 0,
      guaranteed_impressions: impressions ? Number(impressions) : 0,
      deadline: deadline || null,
      contact_name: contact.trim() || null,
    });
    if (res?.error) setMsg('שגיאה בשמירה.');
    else {
      setPublisher('');
      setRate('');
      setImpressions('');
      setDeadline('');
      setContact('');
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-5 grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">פאבלישר</span>
        <input value={publisher} onChange={(e) => setPublisher(e.target.value)} className={inputCls} placeholder="Ynet / Walla / ספורט 5" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">סוג דיל</span>
        <select value={dealType} onChange={(e) => setDealType(e.target.value as PublisherDeal['deal_type'])} className={inputCls}>
          <option value="io">IO (דיל ישיר)</option>
          <option value="pmp">PMP</option>
          <option value="pg">Programmatic Guaranteed</option>
          <option value="preferred">Preferred Deal</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">יחידת תמחור</span>
        <select value={unit} onChange={(e) => setUnit(e.target.value as PublisherDeal['unit'])} className={inputCls}>
          <option value="cpm">CPM</option>
          <option value="cpd">CPD (ליום)</option>
          <option value="fixed">מחיר קבוע</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">מחיר (₪)</span>
        <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={inputCls} dir="ltr" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">נפח מובטח (חשיפות)</span>
        <input value={impressions} onChange={(e) => setImpressions(e.target.value)} inputMode="numeric" className={inputCls} dir="ltr" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">Deadline</span>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} dir="ltr" />
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-[13px] font-semibold">איש קשר בפאבלישר</span>
        <input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <button
          onClick={submit}
          disabled={busy}
          className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-semibold px-4 py-2 rounded-[10px] transition-colors"
        >
          {busy ? 'שומר…' : 'צור דיל'}
        </button>
        {msg && <span className="text-[13px] text-ink-secondary">{msg}</span>}
      </div>
    </div>
  );
}
