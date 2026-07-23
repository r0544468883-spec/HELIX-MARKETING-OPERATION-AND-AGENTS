'use client';

// ניהול תבניות WhatsApp — צפייה בתבניות מובנות + העלאה/עריכה/מחיקה של תבניות מותאמות.
// תבנית מותאמת עם אותו מפתח דורסת את המובנית. מדבר עם /api/templates/{list,custom}.
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Copy, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type WaItem = {
  key: string;
  name: string;
  language: string;
  category: string;
  body: string;
  params: string[];
  sampleParams: string[];
  quickReply: string[] | null;
  urlButton: { text: string; baseUrl: string } | null;
  source: 'builtin' | 'custom';
  overrides: boolean;
};

type EditorData = {
  key: string;
  name: string;
  language: string;
  category: string;
  body: string;
  params: string;
  sampleParams: string;
  quickReply: string;
};

const inputCls =
  'w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-brand transition-colors';
const labelCls = 'block text-[12px] text-ink-secondary mb-1.5 font-semibold';

function splitList(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export default function TemplatesManager({ workspaceId }: { workspaceId: string | null }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<WaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<EditorData | null>(null);

  const qs = workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch(`/api/templates/list${qs}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'load failed');
      setItems((j.whatsapp ?? []) as WaItem[]);
    } catch {
      setError(true);
      toast('טעינת התבניות נכשלה', 'error');
    }
    setLoading(false);
  }, [qs, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () =>
    setEditor({ key: '', name: '', language: 'he', category: 'UTILITY', body: '', params: '', sampleParams: '', quickReply: '' });

  const openFrom = (i: WaItem, asClone: boolean) =>
    setEditor({
      key: asClone ? `${i.key}_copy` : i.key,
      name: asClone ? `${i.name}_copy` : i.name,
      language: i.language,
      category: i.category === 'MARKETING' ? 'MARKETING' : 'UTILITY',
      body: i.body,
      params: i.params.join(', '),
      sampleParams: i.sampleParams.join(', '),
      quickReply: (i.quickReply ?? []).join(', '),
    });

  async function save() {
    if (!editor) return;
    const d = editor;
    if (!d.key.trim()) return toast('חובה מפתח (key)', 'error');
    if (!/^[a-z0-9_]+$/.test(d.name)) return toast('שם התבנית חייב להיות באותיות a-z, ספרות ו-_', 'error');
    if (!d.body.trim()) return toast('חובה גוף הודעה', 'error');
    setSaving(true);
    try {
      const definition: Record<string, unknown> = {
        name: d.name.trim(),
        language: d.language.trim() || 'he',
        category: d.category,
        body: d.body,
        params: splitList(d.params),
        sampleParams: splitList(d.sampleParams),
      };
      if (d.quickReply.trim()) definition.quickReply = splitList(d.quickReply);
      const r = await fetch(`/api/templates/custom${qs}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'whatsapp', key: d.key.trim(), definition }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.results?.[0]?.error || j.error || 'שמירה נכשלה');
      toast('התבנית נשמרה', 'success');
      setEditor(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'שמירה נכשלה', 'error');
    }
    setSaving(false);
  }

  async function remove(key: string) {
    const ok = await confirm({
      title: 'מחיקת תבנית מותאמת',
      message: `למחוק את "${key}"? אם קיימת תבנית מובנית עם אותו מפתח — היא תחזור לפעולה.`,
      confirmLabel: 'מחק',
      danger: true,
    });
    if (!ok) return;
    try {
      const sep = qs ? '&' : '?';
      await fetch(`/api/templates/custom${qs}${sep}kind=whatsapp&key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      toast('התבנית נמחקה', 'success');
      load();
    } catch {
      toast('מחיקה נכשלה', 'error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <span className="text-[13px] text-ink-muted">{items.length} תבניות</span>
        <button
          onClick={openNew}
          className="glow inline-flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-bg text-[14px] font-bold px-4 py-2 rounded-[10px] transition-all active:scale-95 min-h-[44px]"
        >
          <Plus size={16} /> תבנית חדשה
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="text-ink-secondary text-[14px] mb-4">לא הצלחנו לטעון את התבניות.</p>
          <button onClick={load} className="bg-surface border border-border hover:border-brand rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors">
            נסה שוב
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <span className="animate-float text-3xl block mb-3">📄</span>
          <p className="text-ink-secondary text-[14px] mb-4">אין עדיין תבניות. צרו את הראשונה שלכם.</p>
          <button onClick={openNew} className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-bg text-[14px] font-bold px-4 py-2 rounded-[10px] transition-all active:scale-95">
            <Plus size={16} /> תבנית חדשה
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((i) => (
            <div key={i.key} className="card-hover rounded-xl border border-border bg-surface p-4 flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <strong className="text-[14px] font-bold">{i.name}</strong>
                  <Badge tone={i.category === 'MARKETING' ? 'amber' : 'slate'}>{i.category}</Badge>
                  {i.source === 'custom' ? (
                    <Badge tone="brand">{i.overrides ? 'דורס מובנה' : 'מותאם'}</Badge>
                  ) : (
                    <Badge tone="slate">מובנה</Badge>
                  )}
                  {i.quickReply && <Badge tone="cyan">Quick-Reply</Badge>}
                  <span className="text-[11px] text-ink-muted font-mono">{i.language}</span>
                </div>
                <p className="text-ink-secondary text-[12.5px] leading-relaxed line-clamp-2" dir="auto">
                  {i.body}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {i.source === 'custom' ? (
                  <button
                    onClick={() => openFrom(i, false)}
                    aria-label={`ערוך ${i.name}`}
                    className="inline-flex items-center gap-1 border border-border hover:border-brand rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition-colors min-h-[44px]"
                  >
                    <Pencil size={14} /> ערוך
                  </button>
                ) : (
                  <button
                    onClick={() => openFrom(i, true)}
                    aria-label={`שכפל ${i.name} כמותאם`}
                    className="inline-flex items-center gap-1 border border-border hover:border-brand rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition-colors min-h-[44px]"
                  >
                    <Copy size={14} /> שכפל כמותאם
                  </button>
                )}
                {i.source === 'custom' && (
                  <button
                    onClick={() => remove(i.key)}
                    aria-label={`מחק ${i.name}`}
                    className="inline-flex items-center border border-border hover:border-red-500 text-red-400 rounded-lg px-2.5 py-2 transition-colors min-h-[44px]"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editor && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setEditor(null)}
            role="dialog"
            aria-modal="true"
            aria-label="עריכת תבנית"
          >
            <motion.div
              className="bg-bg border border-border rounded-2xl p-6 w-full max-w-[560px] my-10 shadow-xl"
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-[18px] font-bold mb-4">תבנית WhatsApp</h2>
              <div className="grid gap-3.5">
                <div>
                  <label className={labelCls} htmlFor="tpl-key">מפתח (key)</label>
                  <input id="tpl-key" className={inputCls} value={editor.key} placeholder="למשל price / my_promo"
                    onChange={(e) => setEditor({ ...editor, key: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="tpl-name">שם התבנית ב-Meta (a-z0-9_)</label>
                  <input id="tpl-name" className={inputCls} value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className={labelCls} htmlFor="tpl-cat">קטגוריה</label>
                    <select id="tpl-cat" className={inputCls} value={editor.category}
                      onChange={(e) => setEditor({ ...editor, category: e.target.value })}>
                      <option value="UTILITY">UTILITY</option>
                      <option value="MARKETING">MARKETING</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className={labelCls} htmlFor="tpl-lang">שפה</label>
                    <input id="tpl-lang" className={inputCls} value={editor.language}
                      onChange={(e) => setEditor({ ...editor, language: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelCls} htmlFor="tpl-body">{'גוף ההודעה ({{1}}, {{2}}…)'}</label>
                  <textarea id="tpl-body" className={`${inputCls} min-h-[96px] resize-y`} value={editor.body} dir="auto"
                    onChange={(e) => setEditor({ ...editor, body: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="tpl-params">פרמטרים (תיאור, מופרד בפסיקים)</label>
                  <input id="tpl-params" className={inputCls} value={editor.params} placeholder="שם, תאריך, שעה"
                    onChange={(e) => setEditor({ ...editor, params: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="tpl-samples">דוגמאות לפרמטרים (מופרד בפסיקים)</label>
                  <input id="tpl-samples" className={inputCls} value={editor.sampleParams} placeholder="דנה, 12/08, 10:30"
                    onChange={(e) => setEditor({ ...editor, sampleParams: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="tpl-qr">כפתורי Quick-Reply (אופציונלי, מופרד בפסיקים)</label>
                  <input id="tpl-qr" className={inputCls} value={editor.quickReply} placeholder="אישור, ביטול"
                    onChange={(e) => setEditor({ ...editor, quickReply: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2.5 mt-5">
                <button onClick={save} disabled={saving}
                  className="bg-brand hover:bg-brand-hover text-bg font-bold px-5 py-2.5 rounded-[10px] transition-all active:scale-95 disabled:opacity-60 min-h-[44px]">
                  {saving ? 'שומר…' : 'שמירה'}
                </button>
                <button onClick={() => setEditor(null)}
                  className="border border-border hover:border-border-strong text-ink-secondary font-semibold px-5 py-2.5 rounded-[10px] transition-colors min-h-[44px]">
                  ביטול
                </button>
              </div>
              <p className="text-ink-muted text-[12px] mt-3.5">
                אחרי שמירה — הריצו סנכרון תבניות ואשרו את התבנית ב-WhatsApp Manager לפני שליחה מחוץ לחלון 24 שעות.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'slate' | 'brand' | 'amber' | 'cyan' }) {
  const cls =
    tone === 'brand'
      ? 'bg-brand/15 text-brand border-brand/30'
      : tone === 'amber'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : tone === 'cyan'
          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
          : 'bg-white/5 text-ink-secondary border-border';
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
}
