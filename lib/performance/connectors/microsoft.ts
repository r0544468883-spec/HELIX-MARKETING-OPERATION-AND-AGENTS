import type { AdConnector, ChannelConfig } from './types';
import { cfg, jsonFetch } from './types';

// Microsoft Advertising (Bing Ads). This connector wires the real OAuth handshake and registers
// the platform; the mutations are not implemented yet (they degrade cleanly per the SPI).
//
// REUSE NOTE (corrected 2026-08-18): two ready-made paths to finish this — pick before hand-rolling:
//   1. Microsoft Advertising REST API (v13) is the go-forward standard (SOAP retires 2026-10-01) and
//      fits this dep-free jsonFetch SPI — base https://campaign.api.bingads.microsoft.com/... with
//      Authorization + DeveloperToken + CustomerId + CustomerAccountId headers. Preferred, but needs a
//      live account to verify the exact resource paths (we don't ship unverified ad-API guesses).
//   2. `mcp-bing-ads` (npm, maintained, v1.1.0 Aug-2026) — an MCP server exposing campaign/adgroup/
//      keyword/reporting. Doesn't fit a serverless direct-fetch connector, but is the drop-in option
//      if OPS grows an MCP-client path.
// Until one is wired (with a test account), the actions below degrade cleanly. See docs/OPS-CONNECTORS.md.
//
// config: { client_id, refresh_token, developer_token, account_id, customer_id }.
const OAUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const NOT_IMPL = 'microsoft_rest_or_mcp_pending'; // see REUSE NOTE — REST(v13) or mcp-bing-ads

async function token(config: ChannelConfig): Promise<string | null> {
  const direct = cfg(config, 'access_token', 'MSADS_ACCESS_TOKEN');
  if (direct) return direct;
  const clientId = cfg(config, 'client_id', 'MSADS_CLIENT_ID');
  const refresh = cfg(config, 'refresh_token', 'MSADS_REFRESH_TOKEN');
  if (!clientId || !refresh) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refresh,
    scope: 'https://ads.microsoft.com/msads.manage offline_access',
  });
  const clientSecret = cfg(config, 'client_secret', 'MSADS_CLIENT_SECRET');
  if (clientSecret) body.set('client_secret', clientSecret);
  const { ok, json } = await jsonFetch(OAUTH, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return ok ? ((json['access_token'] as string) ?? null) : null;
}

/** True only when the OAuth handshake + required ids are present (capability probe). */
async function ready(config: ChannelConfig): Promise<boolean> {
  const t = await token(config);
  const dev = cfg(config, 'developer_token', 'MSADS_DEVELOPER_TOKEN');
  const acct = cfg(config, 'account_id', 'MSADS_ACCOUNT_ID');
  return Boolean(t && dev && acct);
}

export const microsoftConnector: AdConnector = {
  platform: 'Microsoft',

  // Auth is wired below; mutations pending a REST(v13) impl or the mcp-bing-ads path (see REUSE NOTE).
  async pauseAd(config) {
    await ready(config);
    return false; // pause: REST v13 CampaignUpdate or mcp-bing-ads pending
  },

  async setBudget(config) {
    await ready(config);
    return false; // budget: REST v13 CampaignUpdate(dailyBudget) or mcp-bing-ads pending
  },

  async uploadCreative(config) {
    const ok = await ready(config);
    return { ok: false, error: ok ? NOT_IMPL : 'microsoft_not_configured' };
  },

  async fetchInsights(config) {
    await ready(config);
    return null; // insights: REST v13 Reporting or mcp-bing-ads pending
  },

  async createCampaign(config, spec) {
    const ok = await ready(config);
    return {
      ok: false,
      error: ok ? NOT_IMPL : 'microsoft_not_configured',
      note: ok
        ? `microsoft: OAuth ok, but campaign create pending REST v13 (or mcp-bing-ads) (spec "${spec.name}" not sent).`
        : undefined,
    };
  },
};
