import type { ChannelConfig, SendResult } from './types';

// TikTok Content Posting API — config: { access_token, video_url, title? }. Requires a video (PULL_FROM_URL).
export async function sendTikTok(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const videoUrl = config.video_url as string | undefined;
  if (!token) return { ok: false, error: 'tiktok_not_configured' };
  if (!videoUrl) return { ok: false, error: 'tiktok_requires_video' };
  const title = (config.title as string | undefined) || content.slice(0, 150);
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        post_info: { title, privacy_level: 'PUBLIC_TO_EVERYONE' },
        source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: { publish_id?: string };
      error?: { message?: string; code?: string };
    };
    if (!res.ok || (json.error && json.error.code !== 'ok')) {
      return { ok: false, error: json.error?.message ?? `tiktok_${res.status}` };
    }
    return { ok: true, externalId: json.data?.publish_id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
