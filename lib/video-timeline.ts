import type { Caption } from '@remotion/captions';

export type VideoClip = {
  id: string;
  type: 'video' | 'image';
  url: string;
  durationInFrames: number;
};

export type VideoTimeline = {
  fps: number;
  width: number;
  height: number;
  clips: VideoClip[];
  audioUrl: string | null;
  captions: Caption[];
};

export const FPS = 30;
export const VIDEO_W = 1080;
export const VIDEO_H = 1920; // vertical — TikTok / Reels / Shorts
export const DEFAULT_IMAGE_FRAMES = 90; // 3s

export function totalFrames(t: VideoTimeline): number {
  return Math.max(1, t.clips.reduce((s, c) => s + c.durationInFrames, 0));
}

export function emptyTimeline(): VideoTimeline {
  return { fps: FPS, width: VIDEO_W, height: VIDEO_H, clips: [], audioUrl: null, captions: [] };
}

// Split a script into captions timed evenly across the total video duration.
export function captionsFromScript(script: string, totalMs: number): Caption[] {
  const parts = script
    .split(/(?<=[.!?…\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0 || totalMs <= 0) return [];
  const per = totalMs / parts.length;
  return parts.map((text, i) => ({
    text,
    startMs: Math.round(i * per),
    endMs: Math.round((i + 1) * per),
    timestampMs: Math.round((i + 0.5) * per),
    confidence: null,
  }));
}
