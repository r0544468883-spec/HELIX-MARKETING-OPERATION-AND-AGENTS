import type { ChannelConfig, SendResult } from './types';
import { finalizeEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { nip19 } from 'nostr-tools';
import WebSocketImpl from 'ws';

// nostr-tools needs a global WebSocket; provide one in Node.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}

// Nostr — config: { nsec, relays? }. Signs a kind-1 note and publishes to relays.
export async function sendNostr(config: ChannelConfig, content: string): Promise<SendResult> {
  const nsec = config.nsec as string | undefined;
  const relaysStr = (config.relays as string | undefined) || 'wss://relay.damus.io,wss://nos.lol';
  if (!nsec) return { ok: false, error: 'nostr_not_configured' };
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') return { ok: false, error: 'nostr_invalid_key' };
    const sk = decoded.data as Uint8Array;
    const event = finalizeEvent(
      { kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content },
      sk
    );
    const relays = relaysStr.split(',').map((r) => r.trim()).filter(Boolean);
    const pool = new SimplePool();
    await Promise.any(pool.publish(relays, event));
    pool.close(relays);
    return { ok: true, externalId: event.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
