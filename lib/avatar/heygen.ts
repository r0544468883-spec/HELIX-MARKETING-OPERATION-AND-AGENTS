// HeyGen — realistic talking-avatar video from a script. Async: submit → poll.
// Highest quality; supports Hebrew TTS (verify voice quality per voice_id).
export async function submitHeygen(key: string, opts: { script: string; avatarId?: string; voiceId?: string }): Promise<string> {
  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: opts.avatarId || 'default', avatar_style: 'normal' },
        voice: { type: 'text', input_text: opts.script.slice(0, 1500), voice_id: opts.voiceId || 'default' },
      }],
      dimension: { width: 1080, height: 1920 },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { video_id?: string }; error?: string };
  if (!res.ok || !json.data?.video_id) throw new Error(json.error || `heygen_${res.status}`);
  return json.data.video_id;
}

export async function pollHeygen(key: string, videoId: string): Promise<{ status: 'processing' | 'done' | 'failed'; videoUrl?: string }> {
  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, { headers: { 'X-Api-Key': key } });
  if (!res.ok) return { status: 'processing' };
  const json = (await res.json()) as { data?: { status?: string; video_url?: string } };
  const s = json.data?.status;
  if (s === 'completed') return { status: 'done', videoUrl: json.data?.video_url };
  if (s === 'failed') return { status: 'failed' };
  return { status: 'processing' };
}
