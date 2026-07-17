'use client';

// Video Studio — upload clips/images/audio, the studio assembles them into a video
// (order + timing + captions from the script), preview with Remotion Player, tweak, save.
// Effects/captions styled from EFFECTS.md. Uses the user's Remotion setup.

import { useMemo, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { saveVideoTimeline, setVideoRendered } from '@/app/actions-ops';
import { useToast } from '@/components/ui/Toast';
import { celebrate } from '@/lib/confetti';
import { VideoComposition } from '@/components/video/VideoComposition';
import {
  FPS,
  VIDEO_W,
  VIDEO_H,
  DEFAULT_IMAGE_FRAMES,
  captionsFromScript,
  totalFrames,
  type VideoTimeline,
  type VideoClip,
} from '@/lib/video-timeline';

const Player = dynamic(() => import('@remotion/player').then((m) => m.Player), { ssr: false });

function readSeconds(file: File, type: 'video' | 'image'): Promise<number> {
  if (type === 'image') return Promise.resolve(DEFAULT_IMAGE_FRAMES / FPS);
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve(el.duration && isFinite(el.duration) ? el.duration : 3);
    el.onerror = () => resolve(3);
    el.src = URL.createObjectURL(file);
  });
}

export default function VideoStudio({
  requestId,
  script,
  initial,
}: {
  requestId: string;
  script: string;
  initial: VideoTimeline | null;
}) {
  const { toast } = useToast();
  const [clips, setClips] = useState<VideoClip[]>(initial?.clips ?? []);
  const [audioUrl, setAudioUrl] = useState<string | null>(initial?.audioUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [saving, startSave] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const timeline: VideoTimeline = useMemo(() => {
    const base: VideoTimeline = { fps: FPS, width: VIDEO_W, height: VIDEO_H, clips, audioUrl, captions: [] };
    const totalMs = (totalFrames(base) / FPS) * 1000;
    return { ...base, captions: captionsFromScript(script, totalMs) };
  }, [clips, audioUrl, script]);

  async function upload(file: File, folder: string): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${requestId}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('ops-assets').upload(path, file);
    if (error) return null;
    return supabase.storage.from('ops-assets').getPublicUrl(path).data.publicUrl;
  }

  async function onAddMedia(e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const seconds = await readSeconds(file, type);
    const url = await upload(file, type);
    setBusy(false);
    if (!url) {
      toast('שגיאה בהעלאה', 'error');
      return;
    }
    setClips((c) => [...c, { id: crypto.randomUUID(), type, url, durationInFrames: Math.round(seconds * FPS) }]);
    e.target.value = '';
  }

  async function onAddAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const url = await upload(file, 'audio');
    setBusy(false);
    if (url) {
      setAudioUrl(url);
      toast('סאונד נוסף ✓', 'success');
    }
    e.target.value = '';
  }

  const move = (i: number, dir: -1 | 1) =>
    setClips((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.length) return c;
      const n = [...c];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const remove = (id: string) => setClips((c) => c.filter((x) => x.id !== id));

  function save() {
    startSave(async () => {
      const res = await saveVideoTimeline(requestId, timeline);
      toast(res?.error ? 'שגיאה בשמירה' : 'הסרטון נשמר ✓', res?.error ? 'error' : 'success');
    });
  }

  async function doExport() {
    if (clips.length === 0) return;
    setExporting(true);
    setProgress(0);
    try {
      await saveVideoTimeline(requestId, timeline);
      const { exportTimeline } = await import('@/lib/video-export');
      const blob = await exportTimeline(timeline, (p) => setProgress(p));
      const supabase = createClient();
      const path = `${requestId}/render/${crypto.randomUUID()}.mp4`;
      const { error } = await supabase.storage.from('ops-assets').upload(path, blob);
      if (error) throw new Error(error.message);
      const url = supabase.storage.from('ops-assets').getPublicUrl(path).data.publicUrl;
      await setVideoRendered(requestId, url);
      toast('הסרטון יוצא בהצלחה ✓', 'success');
      celebrate();
    } catch (e) {
      toast('שגיאה בייצוא: ' + (e as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  }

  const dur = totalFrames(timeline);
  const uploadBtn =
    'text-[13px] border border-border hover:border-brand rounded-[10px] px-3 py-2 cursor-pointer transition-colors active:scale-95 min-h-[44px] inline-flex items-center';

  return (
    <section className="mt-10">
      <h2 className="font-bold text-[18px] mb-1">🎬 סטודיו וידאו</h2>
      <p className="text-ink-secondary text-[14px] mb-4">
        העלו קליפים, תמונות וסאונד — הסטודיו מרכיב סרטון עם כתוביות מהתוכן. גררו לסדר, וצפו בתצוגה מקדימה.
      </p>

      <div className="flex flex-wrap gap-3 mb-5">
        <label className={uploadBtn}>
          + קליפ וידאו
          <input type="file" accept="video/*" onChange={(e) => onAddMedia(e, 'video')} disabled={busy} className="hidden" />
        </label>
        <label className={uploadBtn}>
          + תמונה
          <input type="file" accept="image/*" onChange={(e) => onAddMedia(e, 'image')} disabled={busy} className="hidden" />
        </label>
        <label className={uploadBtn}>
          + סאונד
          <input type="file" accept="audio/*" onChange={onAddAudio} disabled={busy} className="hidden" />
        </label>
        {busy && (
          <span className="inline-flex items-center text-[13px] text-ink-secondary">
            מעלה
            <span className="inline-flex items-center ms-2">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-6">
        <div>
          {clips.length > 0 ? (
            <div className="rounded-xl overflow-hidden border border-border">
              <Player
                component={VideoComposition}
                inputProps={{ timeline }}
                durationInFrames={dur}
                compositionWidth={VIDEO_W}
                compositionHeight={VIDEO_H}
                fps={FPS}
                style={{ width: '100%' }}
                controls
                loop
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border aspect-[9/16] flex items-center justify-center text-ink-muted text-[14px] text-center p-4">
              העלו קבצים כדי להתחיל
            </div>
          )}
          {audioUrl && <p className="text-[12px] text-ink-muted mt-2">🎵 סאונד מחובר</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[15px]">רצף ({clips.length})</h3>
            <span className="text-[12px] text-ink-muted">{(dur / FPS).toFixed(1)} שנ׳</span>
          </div>
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {clips.map((clip, i) => (
                <motion.div
                  key={clip.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="bg-surface border border-border rounded-[10px] p-2 flex items-center gap-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {clip.type === 'image' ? (
                    <img src={clip.url} alt="" className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-bg flex items-center justify-center text-[18px]">🎞</div>
                  )}
                  <span className="flex-1 text-[13px] text-ink-secondary">
                    {clip.type === 'video' ? 'קליפ' : 'תמונה'} · {(clip.durationInFrames / FPS).toFixed(1)}s
                  </span>
                  <button onClick={() => move(i, -1)} aria-label="למעלה" className="text-ink-muted hover:text-ink px-1">↑</button>
                  <button onClick={() => move(i, 1)} aria-label="למטה" className="text-ink-muted hover:text-ink px-1">↓</button>
                  <button onClick={() => remove(clip.id)} aria-label="הסר" className="text-red-400 hover:text-red-300 px-1">×</button>
                </motion.div>
              ))}
            </AnimatePresence>
            {clips.length === 0 && <p className="text-ink-muted text-[13px]">אין קבצים עדיין.</p>}
          </div>

          {clips.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={save}
                  disabled={saving || exporting}
                  className="border border-border hover:border-border-strong disabled:opacity-50 text-ink font-semibold px-4 py-2.5 rounded-[10px] transition-colors active:scale-95"
                >
                  {saving ? 'שומר…' : 'שמור'}
                </button>
                <button
                  onClick={doExport}
                  disabled={exporting}
                  className="glow bg-brand hover:bg-brand-hover disabled:opacity-50 text-bg font-bold px-5 py-2.5 rounded-[10px] transition-all active:scale-95"
                >
                  {exporting ? `מייצא… ${Math.round(progress * 100)}%` : '🎬 ייצא MP4'}
                </button>
              </div>
              {exporting && (
                <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${progress * 100}%` }} />
                </div>
              )}
              <p className="text-[12px] text-ink-muted">
                הייצוא רץ בדפדפן (mediabunny) — אפס עלות שרת. ה-MP4 נשמר וזורם ל-TikTok/YouTube.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
