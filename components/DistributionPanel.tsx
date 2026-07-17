'use client';

// Distribution — publish the request's 'ready' drafts to connected channels (now or scheduled).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishDrafts } from '@/app/actions-ops';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { celebrate } from '@/lib/confetti';

export type Publication = {
  id: string;
  channel: string;
  status: string;
  error: string | null;
  scheduled_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  sent: { label: 'נשלח', cls: 'text-green-400' },
  pending: { label: 'מתוזמן', cls: 'text-yellow-400' },
  failed: { label: 'נכשל', cls: 'text-red-400' },
};

export default function DistributionPanel({
  requestId,
  readyChannels,
  connectedChannels,
  publications,
}: {
  requestId: string;
  readyChannels: string[];
  connectedChannels: string[];
  publications: Publication[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [when, setWhen] = useState('');

  const publishable = readyChannels.filter((c) => connectedChannels.includes(c));
  const missing = readyChannels.filter((c) => !connectedChannels.includes(c));

  function publish(schedule: boolean) {
    start(async () => {
      if (!schedule) {
        const ok = await confirm({
          title: 'פרסום',
          message: `לפרסם עכשיו ל-${publishable.length} ערוצים מחוברים? הפעולה שולחת בפועל.`,
          confirmLabel: 'פרסם',
        });
        if (!ok) return;
      }
      const iso = schedule && when ? new Date(when).toISOString() : null;
      const res = await publishDrafts(requestId, iso);
      if (res?.error) {
        toast(
          res.error === 'no_ready_drafts' ? 'אין טיוטות מסומנות "מוכן".' : `שגיאה בפרסום: ${res.error}`,
          'error'
        );
      } else {
        toast(
          schedule
            ? `תוזמנו ${res.queued} פרסומים ✓`
            : `נשלחו ${res.sent}, נכשלו ${res.failed}${res.skipped ? `, דולגו ${res.skipped}` : ''}`,
          res.failed ? 'info' : 'success'
        );
        if (!schedule && !res.failed && res.sent) celebrate();
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-10">
      <h2 className="font-bold text-[18px] mb-1">הפצה</h2>
      <p className="text-ink-secondary text-[14px] mb-4">
        פרסום הטיוטות המסומנות "מוכן" לערוצים המחוברים — עכשיו או בתזמון.
      </p>

      {readyChannels.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-6 text-ink-secondary text-[15px]">
          אין טיוטות מוכנות. סמנו טיוטה "מוכן" בסטודיו התוכן כדי לאפשר הפצה.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {publishable.map((c) => (
              <span key={c} className="text-[13px] bg-bg border border-brand rounded-full px-3 py-1 text-ink">
                {c} ✓
              </span>
            ))}
            {missing.map((c) => (
              <span
                key={c}
                className="text-[13px] bg-bg border border-border rounded-full px-3 py-1 text-ink-muted"
                title="אין חיבור ערוץ פעיל"
              >
                {c} — חסר חיבור
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <button
              onClick={() => publish(false)}
              disabled={pending || publishable.length === 0}
              className="glow bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-5 py-2.5 rounded-[10px] transition-all active:scale-95"
            >
              {pending ? 'מפרסם…' : 'פרסם עכשיו'}
            </button>
            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-ink-muted">תזמון</span>
                <input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand"
                />
              </label>
              <button
                onClick={() => publish(true)}
                disabled={pending || !when || publishable.length === 0}
                className="border border-border hover:border-border-strong disabled:opacity-50 text-ink font-semibold px-4 py-2.5 rounded-[10px] transition-colors"
              >
                תזמן
              </button>
            </div>
          </div>
        </div>
      )}

      {publications.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold text-[15px] mb-2">היסטוריית פרסומים</h3>
          <div className="flex flex-col gap-2">
            {publications.map((p) => {
              const s = STATUS_LABEL[p.status] ?? { label: p.status, cls: 'text-ink-muted' };
              return (
                <div
                  key={p.id}
                  className="bg-surface border border-border rounded-[10px] p-3 text-[14px] flex items-center justify-between gap-3"
                >
                  <span className="font-semibold">{p.channel}</span>
                  <span className={s.cls}>
                    {s.label}
                    {p.error ? ` — ${p.error}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
