import 'server-only';

// Ad-platform OAuth — the "connect your account in one click" piece. Each provider needs
// a registered app (client id/secret) supplied via env. When those aren't set, the
// provider is simply "not available" and the UI falls back to manual token paste — so
// this degrades cleanly until the client completes Meta/Google/TikTok app review.
//
// Flow: /api/oauth/[platform]/start → provider consent → /api/oauth/[platform]/callback
// → exchange code for a token → write it into channel_connections.config for that channel.
// Outbrain is NOT here: it authenticates with username/password → OB token (no OAuth).

export type OAuthPlatform = 'meta' | 'google' | 'tiktok';

// Channel label (in channel_connections) each OAuth platform writes its creds under.
export const OAUTH_CHANNEL: Record<OAuthPlatform, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
};

type ProviderEnv = { clientId?: string; clientSecret?: string };
function envFor(p: OAuthPlatform): ProviderEnv {
  switch (p) {
    case 'meta':
      return { clientId: process.env.META_APP_ID, clientSecret: process.env.META_APP_SECRET };
    case 'google':
      return { clientId: process.env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET };
    case 'tiktok':
      return { clientId: process.env.TIKTOK_APP_ID, clientSecret: process.env.TIKTOK_APP_SECRET };
  }
}

/** Which OAuth platforms have an app configured (client id + secret present). */
export function availableOAuthPlatforms(): OAuthPlatform[] {
  return (['meta', 'google', 'tiktok'] as OAuthPlatform[]).filter((p) => {
    const e = envFor(p);
    return !!(e.clientId && e.clientSecret);
  });
}

export function isOAuthPlatform(p: string): p is OAuthPlatform {
  return p === 'meta' || p === 'google' || p === 'tiktok';
}

/** Build the provider's consent URL. redirectUri must exactly match the callback route. */
export function authorizeUrl(p: OAuthPlatform, redirectUri: string, state: string): string | null {
  const { clientId } = envFor(p);
  if (!clientId) return null;
  const enc = encodeURIComponent;
  switch (p) {
    case 'meta':
      return (
        `https://www.facebook.com/v20.0/dialog/oauth?client_id=${enc(clientId)}` +
        `&redirect_uri=${enc(redirectUri)}&state=${enc(state)}` +
        `&scope=${enc('ads_management,ads_read,business_management,pages_show_list')}`
      );
    case 'google':
      return (
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=${enc(clientId)}` +
        `&redirect_uri=${enc(redirectUri)}&response_type=code&access_type=offline&prompt=consent` +
        `&state=${enc(state)}&scope=${enc('https://www.googleapis.com/auth/adwords')}`
      );
    case 'tiktok':
      return (
        `https://business-api.tiktok.com/portal/auth?app_id=${enc(clientId)}` +
        `&redirect_uri=${enc(redirectUri)}&state=${enc(state)}`
      );
  }
}

export type ExchangedCreds = Record<string, unknown> & { access_token?: string };

/** Exchange the authorization code for platform creds to merge into channel config. */
export async function exchangeCode(p: OAuthPlatform, code: string, redirectUri: string): Promise<ExchangedCreds | null> {
  const { clientId, clientSecret } = envFor(p);
  if (!clientId || !clientSecret) return null;
  try {
    if (p === 'meta') {
      const url =
        `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${encodeURIComponent(clientId)}` +
        `&client_secret=${encodeURIComponent(clientSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
      const res = await fetch(url);
      const j = (await res.json().catch(() => ({}))) as { access_token?: string };
      if (!res.ok || !j.access_token) return null;
      const creds: ExchangedCreds = { access_token: j.access_token };
      // Best-effort: grab the first ad account + page so the connector is ready to act.
      const acc = await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?fields=account_id&access_token=${j.access_token}`).then((r) => r.json()).catch(() => null);
      const adId = (acc as { data?: { account_id?: string }[] } | null)?.data?.[0]?.account_id;
      if (adId) creds.ad_account_id = adId;
      const pg = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=id&access_token=${j.access_token}`).then((r) => r.json()).catch(() => null);
      const pageId = (pg as { data?: { id?: string }[] } | null)?.data?.[0]?.id;
      if (pageId) creds.page_id = pageId;
      return creds;
    }
    if (p === 'google') {
      const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
      const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string };
      if (!res.ok || !j.access_token) return null;
      // developer_token + customer_id are still required (paste/env) — Google gives neither via OAuth.
      return { access_token: j.access_token, refresh_token: j.refresh_token };
    }
    // tiktok
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id: clientId, secret: clientSecret, auth_code: code }),
    });
    const j = (await res.json().catch(() => ({}))) as { data?: { access_token?: string; advertiser_ids?: string[] } };
    const access = j.data?.access_token;
    if (!access) return null;
    const creds: ExchangedCreds = { access_token: access };
    if (j.data?.advertiser_ids?.[0]) creds.advertiser_id = j.data.advertiser_ids[0];
    return creds;
  } catch {
    return null;
  }
}
