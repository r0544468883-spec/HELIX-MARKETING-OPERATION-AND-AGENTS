// Avatar provider router with HYBRID key resolution: the customer's own key (BYOK)
// wins; otherwise HELIX's managed key is used and the usage is billable.
import { submitHeygen, pollHeygen } from './heygen';
import { submitDid, pollDid } from './did';

export type AvatarProvider = 'heygen' | 'did';
export type AvatarConfig = Record<string, string | undefined>;

const ENV: Record<AvatarProvider, string> = { heygen: 'HEYGEN_API_KEY', did: 'DID_API_KEY' };
const KEYFIELD: Record<AvatarProvider, string> = { heygen: 'heygen_key', did: 'did_key' };

// Returns the key to use + whether it's HELIX-managed (→ bill usage).
export function resolveAvatarKey(config: AvatarConfig, provider: AvatarProvider): { key?: string; managed: boolean } {
  const own = config[KEYFIELD[provider]];
  if (own) return { key: own, managed: false };
  const managed = process.env[ENV[provider]];
  return { key: managed, managed: true };
}

export type AvatarOpts = { script: string; avatarId?: string; avatarImage?: string; voiceId?: string };

export async function submitAvatar(provider: AvatarProvider, key: string, opts: AvatarOpts): Promise<string> {
  if (provider === 'heygen') return submitHeygen(key, opts);
  return submitDid(key, opts);
}
export async function pollAvatar(provider: AvatarProvider, key: string, externalId: string) {
  if (provider === 'heygen') return pollHeygen(key, externalId);
  return pollDid(key, externalId);
}
