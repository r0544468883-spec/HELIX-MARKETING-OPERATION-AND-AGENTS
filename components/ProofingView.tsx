'use client';

// Proofing + approval: image with on-asset comment pins, comment list, approve / request-changes.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addAssetVersion, addComment, decideApproval, runLint } from '@/app/actions-ops';
import type { Violation } from '@/lib/brand-linter';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { celebrate } from '@/lib/confetti';
import CountUp from '@/components/ui/CountUp';

type Comment = {
  id: string;
  x: number | null;
  y: number | null;
  body: string;
  resolved: boolean;
  created_at: string;
};
type Version = { id: string; version: number; image_url: string } | null;

export default function ProofingView({
  locale,
  requestId,
  assetId,
  version,
  comments: initialComments,
  hasBrandGuide,
  initialBrandCheck,
}: {
  locale: string;
  requestId: string;
  assetId: string | null;
  version: Version;
  comments: Comment[];
  hasBrandGuide: boolean;
  initialBrandCheck: { score: number; violations: Violation[] } | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState('');
  const [note, setNote] = useState('');
  const [brand, setBrand] = useState<{ score: number; violations: Violation[] } | null>(initialBrandCheck);
  const [lintPending, setLintPending] = useState(false);

  async function runBrand() {
    if (!version) return;
    setLintPending(true);
    const res = await runLint(version.id);
    setLintPending(false);
    if (res?.ok) setBrand({ score: res.score, violations: res.violations });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `${requestId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('ops-assets').upload(path, file);
      if (!error) {
        const url = supabase.storage.from('ops-assets').getPublicUrl(path).data.publicUrl;
        await addAssetVersion(requestId, url);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  function onImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDraft({ x, y });
    setDraftText('');
  }

  async function submitComment() {
    if (!version || !draft || !draftText.trim()) return;
    setPending(true);
    const res = await addComment(version.id, draft.x, draft.y, draftText.trim());
    setPending(false);
    if (res?.ok && res.comment) {
      setComments((c) => [...c, res.comment as Comment]);
      setDraft(null);
      setDraftText('');
    }
  }

  async function decide(decision: 'approved' | 'changes_requested') {
    if (!assetId) return;
    const ok = await confirm({
      title: decision === 'approved' ? 'אישור נכס' : 'בקשת שינויים',
      message:
        decision === 'approved'
          ? 'לאשר את הנכס? הבקשה תעבור ל"מאושר".'
          : 'לשלוח בקשת שינויים? הבקשה תחזור ל"בעבודה".',
      confirmLabel: decision === 'approved' ? 'אישור' : 'שלח',
    });
    if (!ok) return;
    setPending(true);
    const res = await decideApproval(assetId, requestId, decision, note);
    setPending(false);
    if (res?.error) {
      toast(`שגיאה: ${res.error}`, 'error');
      return;
    }
    toast(decision === 'approved' ? 'הנכס אושר ✓' : 'בקשת שינויים נשלחה', 'success');
    if (decision === 'approved') celebrate();
    router.push(`/${locale}/requests`);
  }

  // No asset yet — prompt upload.
  if (!version) {
    return (
      <div className="mt-8 bg-surface border border-border rounded-2xl p-10 text-center">
        <p className="text-ink-secondary mb-4">עדיין לא הועלה נכס. העלו תמונה כדי להתחיל תהליך אישור.</p>
        <input type="file" accept="image/*" onChange={onUpload} disabled={pending} className="hidden" id="asset-up" />
        <label
          htmlFor="asset-up"
          className="inline-block bg-brand hover:bg-brand-hover text-bg font-semibold px-5 py-2.5 rounded-[10px] cursor-pointer"
        >
          {pending ? 'מעלה…' : 'העלה נכס'}
        </label>
      </div>
    );
  }

  const pins = comments.filter((c) => c.x != null && c.y != null);

  return (
    <div className="mt-8 grid md:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="relative border border-border rounded-xl overflow-hidden bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={version.image_url}
            alt=""
            className="w-full block cursor-crosshair"
            onClick={onImageClick}
          />
          {pins.map((c, i) => (
            <span
              key={c.id}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-brand text-bg text-[12px] font-bold flex items-center justify-center border-2 border-bg shadow"
              title={c.body}
            >
              {i + 1}
            </span>
          ))}
          {draft && (
            <span
              style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-yellow-400 border-2 border-bg"
            />
          )}
        </div>
        <p className="text-[13px] text-ink-muted mt-2">
          לחצו על התמונה כדי להוסיף הערה במיקום מדויק · גרסה {version.version}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input type="file" accept="image/*" onChange={onUpload} disabled={pending} className="text-[13px] text-ink-secondary" />
          <span className="text-[12px] text-ink-muted">העלאת גרסה חדשה</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {draft && (
          <div className="bg-surface border border-brand rounded-xl p-3">
            <textarea
              rows={3}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              dir="auto"
              placeholder="ההערה שלך…"
              className="w-full bg-bg border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={submitComment}
                disabled={pending || !draftText.trim()}
                className="bg-brand text-bg text-[13px] font-semibold px-3 py-1.5 rounded-[8px] disabled:opacity-50"
              >
                הוסף הערה
              </button>
              <button onClick={() => setDraft(null)} className="text-[13px] text-ink-secondary px-3 py-1.5">
                ביטול
              </button>
            </div>
          </div>
        )}

        <div>
          <h3 className="font-bold text-[15px] mb-2">הערות ({comments.length})</h3>
          <div className="flex flex-col gap-2">
            {comments.map((c, i) => (
              <div key={c.id} className="bg-surface border border-border rounded-[10px] p-3 text-[14px] flex gap-2">
                {c.x != null && (
                  <span className="shrink-0 inline-flex w-5 h-5 rounded-full bg-brand text-bg text-[11px] font-bold items-center justify-center">
                    {pins.findIndex((p) => p.id === c.id) + 1}
                  </span>
                )}
                <span dir="auto">{c.body}</span>
              </div>
            ))}
            {comments.length === 0 && <p className="text-ink-muted text-[13px]">אין הערות עדיין.</p>}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-[15px]">בדיקת מותג</h3>
            {brand && (
              <span
                className={
                  brand.score >= 80 ? 'text-green-400' : brand.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                }
              >
                <CountUp value={brand.score} />/100
              </span>
            )}
          </div>
          {hasBrandGuide ? (
            <>
              <button
                onClick={runBrand}
                disabled={lintPending}
                className="text-[13px] border border-border hover:border-border-strong rounded-[8px] px-3 py-1.5 disabled:opacity-50"
              >
                {lintPending ? 'בודק…' : brand ? '↻ בדוק שוב' : 'בדוק מותג'}
              </button>
              {brand && brand.violations.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {brand.violations.map((v, i) => (
                    <li key={i} className="text-[13px] flex gap-2">
                      <span
                        aria-hidden="true"
                        className={
                          v.severity === 'high'
                            ? 'text-red-400'
                            : v.severity === 'medium'
                              ? 'text-yellow-400'
                              : 'text-ink-muted'
                        }
                      >
                        ●
                      </span>
                      <span dir="auto">
                        <b>{v.type}:</b> {v.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {brand && brand.violations.length === 0 && (
                <p className="text-[13px] text-green-400 mt-2">אין חריגות מותג ✓</p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-ink-muted">
              הגדירו קווי מותג{' '}
              <a href={`/${locale}/brand`} className="text-brand hover:underline">
                כאן
              </a>{' '}
              כדי לאפשר בדיקה.
            </p>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="font-bold text-[15px] mb-2">החלטה</h3>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            dir="auto"
            placeholder="הערת אישור (אופציונלי)"
            className="w-full bg-surface border border-border rounded-[8px] px-3 py-2 text-[14px] outline-none focus:border-brand mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={() => decide('approved')}
              disabled={pending}
              className="flex-1 bg-brand hover:bg-brand-hover text-bg font-bold px-3 py-2 rounded-[10px] disabled:opacity-50"
            >
              אישור ✓
            </button>
            <button
              onClick={() => decide('changes_requested')}
              disabled={pending}
              className="flex-1 bg-surface border border-border hover:border-border-strong text-ink font-semibold px-3 py-2 rounded-[10px] disabled:opacity-50"
            >
              בקשת שינויים
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
