import React from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import type { Caption } from '@remotion/captions';
import type { VideoTimeline } from '@/lib/video-timeline';

// Captions overlay — RTL Hebrew, from EFFECTS.md brand styling.
const CaptionsOverlay: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const active = captions.find((c) => ms >= c.startMs && ms <= c.endMs);
  if (!active) return null;
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: 80 }}>
      <div
        style={{
          direction: 'rtl',
          background: 'rgba(0,0,0,0.62)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 12,
          fontSize: 46,
          fontWeight: 800,
          textAlign: 'center',
          maxWidth: '90%',
          lineHeight: 1.25,
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};

export const VideoComposition: React.FC<{ timeline: VideoTimeline }> = ({ timeline }) => {
  const children: React.ReactNode[] = [];
  timeline.clips.forEach((clip, i) => {
    children.push(
      <TransitionSeries.Sequence key={`s-${clip.id}`} durationInFrames={Math.max(1, clip.durationInFrames)}>
        {clip.type === 'video' ? (
          <OffthreadVideo src={clip.url} />
        ) : (
          <Img src={clip.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </TransitionSeries.Sequence>
    );
    if (i < timeline.clips.length - 1) {
      children.push(
        <TransitionSeries.Transition
          key={`t-${i}`}
          timing={linearTiming({ durationInFrames: 15 })}
          presentation={fade()}
        />
      );
    }
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#121413' }}>
      {children.length ? <TransitionSeries>{children}</TransitionSeries> : null}
      {timeline.audioUrl ? <Audio src={timeline.audioUrl} /> : null}
      <CaptionsOverlay captions={timeline.captions} />
    </AbsoluteFill>
  );
};
