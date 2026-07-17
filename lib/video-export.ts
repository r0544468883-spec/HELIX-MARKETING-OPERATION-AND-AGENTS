'use client';

// Browser-side MP4 export: draw each frame on a canvas (active clip cover-fit + caption),
// encode with mediabunny (CanvasSource → Mp4), mux audio, return a Blob. Zero server cost.

import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource } from 'mediabunny';
import type { VideoTimeline } from './video-timeline';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = reject;
    v.src = url;
  });
}

function seekVideo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      resolve();
    };
    v.addEventListener('seeked', done);
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
  });
}

function drawCover(ctx: CanvasRenderingContext2D, el: HTMLImageElement | HTMLVideoElement, w: number, h: number) {
  const sw = (el as HTMLVideoElement).videoWidth || (el as HTMLImageElement).naturalWidth || w;
  const sh = (el as HTMLVideoElement).videoHeight || (el as HTMLImageElement).naturalHeight || h;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, w: number, h: number) {
  ctx.font = 'bold 46px Heebo, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  const metrics = ctx.measureText(text);
  const boxW = Math.min(w * 0.9, metrics.width + 48);
  const boxH = 84;
  const cx = w / 2;
  const cy = h - 150;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  roundRect(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, cy);
}

export async function exportTimeline(
  timeline: VideoTimeline,
  onProgress?: (p: number) => void
): Promise<Blob> {
  const { width, height, fps, clips, audioUrl } = timeline;
  if (clips.length === 0) throw new Error('no_clips');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas_context');

  // Preload all media
  const media = await Promise.all(
    clips.map(async (c) =>
      c.type === 'image'
        ? ({ type: 'image' as const, el: await loadImage(c.url) })
        : ({ type: 'video' as const, el: await loadVideo(c.url) })
    )
  );

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: 3_000_000 });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  let audioBuffer: AudioBuffer | null = null;
  if (audioUrl) {
    try {
      const ab = await (await fetch(audioUrl)).arrayBuffer();
      const actx = new AudioContext();
      audioBuffer = await actx.decodeAudioData(ab);
      audioSource = new AudioBufferSource({ codec: 'aac', bitrate: 128_000 });
      output.addAudioTrack(audioSource);
    } catch {
      audioSource = null;
    }
  }

  await output.start();

  // clip boundaries in frames
  const boundaries: number[] = [];
  let acc = 0;
  for (const c of clips) {
    boundaries.push(acc);
    acc += Math.max(1, c.durationInFrames);
  }
  const total = acc;
  const frameDur = 1 / fps;

  for (let f = 0; f < total; f++) {
    const t = f / fps;
    let idx = 0;
    for (let i = 0; i < clips.length; i++) if (f >= boundaries[i]) idx = i;
    const m = media[idx];
    const localT = (f - boundaries[idx]) / fps;

    ctx.fillStyle = '#121413';
    ctx.fillRect(0, 0, width, height);
    if (m.type === 'image') {
      drawCover(ctx, m.el, width, height);
    } else {
      await seekVideo(m.el, localT);
      drawCover(ctx, m.el, width, height);
    }
    const ms = t * 1000;
    const cap = timeline.captions.find((c) => ms >= c.startMs && ms <= c.endMs);
    if (cap) drawCaption(ctx, cap.text, width, height);

    await videoSource.add(t, frameDur);
    if (onProgress) onProgress((f + 1) / total);
  }
  videoSource.close();

  if (audioSource && audioBuffer) {
    await audioSource.add(audioBuffer);
    audioSource.close();
  }

  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('export_failed');
  return new Blob([new Uint8Array(buffer)], { type: 'video/mp4' });
}
