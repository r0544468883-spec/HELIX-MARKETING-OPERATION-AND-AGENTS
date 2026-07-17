import type { ChannelConfig, SendResult } from './types';

// Warpcast / Farcaster (via Neynar) — config: { api_key, signer_uuid }. Publishes a cast.
export async function sendWarpcast(config: ChannelConfig, content: string): Promise<SendResult> {
  const apiKey = config.api_key as string | undefined;
  const signerUuid = config.signer_uuid as string | undefined;
  if (!apiKey || !signerUuid) return { ok: false, error: 'warpcast_not_configured' };
  try {
    const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: { api_key: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ signer_uuid: signerUuid, text: content.slice(0, 320) }),
    });
    const json = (await res.json().catch(() => ({}))) as { cast?: { hash?: string }; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `warpcast_${res.status}` };
    return { ok: true, externalId: json.cast?.hash };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
