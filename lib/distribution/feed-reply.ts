// Per-network "reply to someone else's post" adapters (Fuzzy-AI feed engagement).
// Uniform signature: (config, targetId, content) -> SendResult. targetId is the
// platform-native id/uri of the post being replied to.
import type { ChannelConfig, SendResult } from './types';
import { finalizeEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { nip19 } from 'nostr-tools';
import WebSocketImpl from 'ws';

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}

// X (Twitter) — config: { bearer_token }. Reply to a tweet.
export async function replyToTweet(
  config: ChannelConfig,
  tweetId: string,
  content: string
): Promise<SendResult> {
  const token = config.bearer_token as string | undefined;
  if (!token) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: content, reply: { in_reply_to_tweet_id: tweetId } }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }; detail?: string };
    if (!res.ok) return { ok: false, error: json.detail ?? `x_${res.status}` };
    return { ok: true, externalId: json.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Mastodon — config: { instance_url, access_token }. Reply to a status.
export async function replyMastodon(
  config: ChannelConfig,
  statusId: string,
  content: string
): Promise<SendResult> {
  const base = (config.instance_url as string | undefined)?.replace(/\/+$/, '');
  const token = config.access_token as string | undefined;
  if (!base || !token) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(`${base}/api/v1/statuses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: content, in_reply_to_id: statusId }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `mastodon_${res.status}` };
    return { ok: true, externalId: json.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Reddit — config: { access_token }. Comment on a thing (t3_/t1_ fullname).
export async function replyReddit(
  config: ChannelConfig,
  thingId: string,
  content: string
): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  if (!token) return { ok: false, error: 'not_configured' };
  try {
    const body = new URLSearchParams({ api_type: 'json', thing_id: thingId, text: content });
    const res = await fetch('https://oauth.reddit.com/api/comment', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'helix-ops/1.0',
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as {
      json?: { data?: { things?: { data?: { id?: string } }[] }; errors?: unknown[] };
    };
    if (!res.ok || (json.json?.errors?.length ?? 0) > 0) {
      return { ok: false, error: `reddit_${res.status}` };
    }
    return { ok: true, externalId: json.json?.data?.things?.[0]?.data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Bluesky (AT Protocol) — config: { pds_url?, access_jwt, did }. Reply to a post.
// targetId is the parent post URI (at://…); we resolve its cid to build the reply.
export async function replyBluesky(
  config: ChannelConfig,
  parentUri: string,
  content: string
): Promise<SendResult> {
  const pds = ((config.pds_url as string | undefined) ?? 'https://bsky.social').replace(/\/+$/, '');
  const jwt = config.access_jwt as string | undefined;
  const did = config.did as string | undefined;
  if (!jwt || !did) return { ok: false, error: 'not_configured' };
  try {
    // Resolve parent cid via getRecord (uri = at://did/collection/rkey).
    const m = parentUri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (!m) return { ok: false, error: 'bad_uri' };
    const [, repo, collection, rkey] = m;
    const getUrl = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=${collection}&rkey=${rkey}`;
    const gr = await fetch(getUrl, { headers: { authorization: `Bearer ${jwt}` } });
    const grJson = (await gr.json().catch(() => ({}))) as { cid?: string };
    if (!gr.ok || !grJson.cid) return { ok: false, error: `bluesky_resolve_${gr.status}` };

    const parent = { uri: parentUri, cid: grJson.cid };
    const record = {
      $type: 'app.bsky.feed.post',
      text: content,
      createdAt: new Date().toISOString(),
      reply: { root: parent, parent },
    };
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
      body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
    });
    const json = (await res.json().catch(() => ({}))) as { uri?: string; error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `bluesky_${res.status}` };
    return { ok: true, externalId: json.uri };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Nostr — config: { nsec, relays? }. Kind-1 reply tagging the parent event id.
export async function replyNostr(
  config: ChannelConfig,
  parentEventId: string,
  content: string
): Promise<SendResult> {
  const nsec = config.nsec as string | undefined;
  const relaysStr = (config.relays as string | undefined) || 'wss://relay.damus.io,wss://nos.lol';
  if (!nsec) return { ok: false, error: 'not_configured' };
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') return { ok: false, error: 'nostr_invalid_key' };
    const sk = decoded.data as Uint8Array;
    const event = finalizeEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', parentEventId, '', 'reply']],
        content,
      },
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
