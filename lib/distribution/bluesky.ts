import type { ChannelConfig, SendResult } from './types';

// Bluesky (AT Protocol) — config: { identifier, app_password }. Text posts (≤300 chars).
export async function sendBluesky(config: ChannelConfig, content: string): Promise<SendResult> {
  const identifier = config.identifier as string | undefined;
  const password = config.app_password as string | undefined;
  if (!identifier || !password) return { ok: false, error: 'bluesky_not_configured' };
  const base = 'https://bsky.social/xrpc';
  try {
    const sessRes = await fetch(`${base}/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const sess = (await sessRes.json().catch(() => ({}))) as { accessJwt?: string; did?: string };
    if (!sessRes.ok || !sess.accessJwt || !sess.did) return { ok: false, error: `bluesky_auth_${sessRes.status}` };

    const res = await fetch(`${base}/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sess.accessJwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        repo: sess.did,
        collection: 'app.bsky.feed.post',
        record: { $type: 'app.bsky.feed.post', text: content.slice(0, 300), createdAt: new Date().toISOString() },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { uri?: string };
    if (!res.ok) return { ok: false, error: `bluesky_${res.status}` };
    return { ok: true, externalId: json.uri };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
