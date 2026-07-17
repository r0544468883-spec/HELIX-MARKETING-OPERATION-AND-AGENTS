import type { ChannelConfig, SendResult } from './types';

// Channels without a public "publish a post" API. Adapters exist for a uniform infrastructure,
// but honestly report that programmatic posting isn't available.
// - Twitch: streaming platform, no content-post API.
// - Kick: no official public API.
// - MeWe: no public posting API.
// - Dribbble: shot creation via API is not publicly available (deprecated).

export async function sendTwitch(_config: ChannelConfig, _content: string): Promise<SendResult> {
  return { ok: false, error: 'twitch_no_public_post_api' };
}
export async function sendKick(_config: ChannelConfig, _content: string): Promise<SendResult> {
  return { ok: false, error: 'kick_no_public_api' };
}
export async function sendMeWe(_config: ChannelConfig, _content: string): Promise<SendResult> {
  return { ok: false, error: 'mewe_no_public_api' };
}
export async function sendDribbble(_config: ChannelConfig, _content: string): Promise<SendResult> {
  return { ok: false, error: 'dribbble_no_public_post_api' };
}
