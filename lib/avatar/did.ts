// D-ID — cheaper talking-head from an avatar image. Can voice via ElevenLabs (best
// Hebrew) when a voice_id prefixed 'el_' is provided; else Microsoft TTS.
export async function submitDid(key: string, opts: { script: string; avatarImage?: string; voiceId?: string }): Promise<string> {
  const useEleven = opts.voiceId?.startsWith('el_');
  const provider = useEleven
    ? { type: 'elevenlabs', voice_id: opts.voiceId!.replace(/^el_/, '') }
    : { type: 'microsoft', voice_id: opts.voiceId || 'he-IL-AvriNeural' };

  const res = await fetch('https://api.d-id.com/talks', {
    method: 'POST',
    headers: { authorization: `Basic ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      source_url: opts.avatarImage || 'https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.jpeg',
      script: { type: 'text', input: opts.script.slice(0, 1500), provider },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; description?: string };
  if (!res.ok || !json.id) throw new Error(json.description || `did_${res.status}`);
  return json.id;
}

export async function pollDid(key: string, id: string): Promise<{ status: 'processing' | 'done' | 'failed'; videoUrl?: string }> {
  const res = await fetch(`https://api.d-id.com/talks/${id}`, { headers: { authorization: `Basic ${key}` } });
  if (!res.ok) return { status: 'processing' };
  const json = (await res.json()) as { status?: string; result_url?: string };
  if (json.status === 'done') return { status: 'done', videoUrl: json.result_url };
  if (json.status === 'error' || json.status === 'rejected') return { status: 'failed' };
  return { status: 'processing' };
}
