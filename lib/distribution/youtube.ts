import type { ChannelConfig, SendResult } from './types';

// YouTube Data API — config: { access_token, video_url, title? }. Fetches the video and uploads it (multipart).
export async function sendYouTube(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const videoUrl = config.video_url as string | undefined;
  if (!token) return { ok: false, error: 'youtube_not_configured' };
  if (!videoUrl) return { ok: false, error: 'youtube_requires_video' };
  const title = (config.title as string | undefined) || content.split('\n')[0].slice(0, 100) || 'Video';
  try {
    const vidRes = await fetch(videoUrl);
    if (!vidRes.ok) return { ok: false, error: 'youtube_video_fetch_failed' };
    const videoBytes = new Uint8Array(await vidRes.arrayBuffer());

    const metadata = {
      snippet: { title, description: content.slice(0, 4900) },
      status: { privacyStatus: 'public' },
    };
    const boundary = 'helix' + Math.random().toString(36).slice(2);
    const enc = new TextEncoder();
    const pre = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/*\r\n\r\n`
    );
    const post = enc.encode(`\r\n--${boundary}--`);
    const body = new Blob([pre, videoBytes, post]);

    const res = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
        body,
      }
    );
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `youtube_${res.status}` };
    return { ok: true, externalId: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
