# HELIX OPS — Ad-Platform Connectors

The performance engine drives every platform through one `AdConnector` SPI
(`lib/performance/connectors/types.ts`): `pauseAd`, `setBudget`, `uploadCreative`,
`fetchInsights`, `createCampaign`. Each connector reads its creds from the workspace's
`channel_connections.config` (env fallback) and degrades cleanly (false/null/error) when
not configured. Register a new one in `connectors/index.ts` (`BY_ALIAS` + `SUPPORTED_PLATFORMS`).

## Coverage
| Platform | pause | budget | insights | createCampaign | uploadCreative | Notes |
|----------|:--:|:--:|:--:|:--:|:--:|-------|
| Meta | ✅ | ✅ | ✅ | ✅ | ✅ | pre-existing |
| Google | ✅ | ✅ | ✅ | ✅ | ✅ | pre-existing |
| TikTok | ✅ | ✅ | ✅ | ✅ | ✅ | pre-existing |
| Outbrain | ✅ | ✅ | ✅ | ✅ | ✅ | pre-existing |
| **Taboola** | ✅ | ✅ | ✅ | ✅ | ✅ | **new 2026-08-18** — Backstage API, Outbrain twin |
| **LinkedIn** | ✅ | ✅ | ✅ | ✅ | ⚠️ | **new** — creative needs a sponsored post first |
| **Microsoft** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **new** — OAuth wired; writes need SOAP (see below) |
| **DV360** | ✅ | ✅ | ⚠️ | ⚠️ | ➖ | **new 2026-08-27** — DSP for premium/publisher inventory via Deal ID (PMP/PG/Preferred). Requires a DV360 seat (Google-certified partner); acts at line-item level |

## Config keys (per `channel_connections.config`, or env fallback)
- **Taboola** — `client_id`, `client_secret`, `account_id` (+ `campaign_id` for uploads).
  Env: `TABOOLA_CLIENT_ID`, `TABOOLA_CLIENT_SECRET`, `TABOOLA_ACCOUNT_ID`, `TABOOLA_CAMPAIGN_ID`.
- **LinkedIn** — `access_token`, `account_id`, `currency?`.
  Env: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_ACCOUNT_ID`, `LINKEDIN_CURRENCY`.
- **Microsoft** — `client_id`, `refresh_token`, `client_secret?`, `developer_token`, `account_id`, `customer_id`.
  Env: `MSADS_CLIENT_ID`, `MSADS_REFRESH_TOKEN`, `MSADS_CLIENT_SECRET`, `MSADS_DEVELOPER_TOKEN`, `MSADS_ACCOUNT_ID`.
- **DV360** — `advertiser_id`, `access_token` (+ optional `partner_id`). Acts at line-item level (`ref.adId` = lineItemId).
  Env: `DV360_ADVERTISER_ID`, `DV360_ACCESS_TOKEN`, `DV360_PARTNER_ID`.
  **⚠️ Requires a DV360 seat first** — not open self-serve; provisioned via a Google-certified partner. The
  channels UI shows an account-opening notice on the DV360 card. `fetchInsights` returns null (Bid Manager async
  reporting, wired later); `createCampaign` returns `dv360_requires_deal` (buys activate a negotiated Deal ID via
  the Managed pipeline, not a self-serve spec); `uploadCreative` unsupported (creatives served via the deal).

## Honest limitations
- **⚠️ Not validated against live ad accounts.** Unlike SHOP's Storefront-MCP (which has a public
  endpoint I verified live), ad platforms require OAuth + a real ad account. The connectors follow the
  documented API shapes and typecheck clean (`tsc --noEmit` → 0 errors), but pause/budget/insights/create
  should be smoke-tested once a sandbox/account + tokens are connected. Same caveat applies to the
  pre-existing Meta/Google/TikTok/Outbrain connectors.
- **LinkedIn `uploadCreative`** returns `linkedin_creative_requires_sponsored_post` — a LinkedIn creative
  wraps an existing ugcPost/share, a multi-call flow not done blind. Pause/budget/insights/create are full.
- **Microsoft — reuse-first re-audit (2026-08-18):** an earlier note here wrongly said "SOAP-only". Corrected:
  (1) the **Microsoft Advertising REST API v13** is the go-forward standard (SOAP retires 2026-10-01) and fits
  this dep-free `jsonFetch` SPI; (2) **`mcp-bing-ads`** (npm, maintained, v1.1.0) is a ready-made MCP server
  covering campaign/adgroup/keyword/reporting. The connector wires OAuth + registers the platform; mutations
  return `microsoft_rest_or_mcp_pending` until one path is wired **with a test account** (we don't ship
  unverified ad-API guesses — same rule that made SHOP's Storefront adapter trustworthy). Preferred: REST v13.

### Reuse-first evidence (why hand-written for the others)
Per the corrected process (search ready-made BEFORE writing): **LinkedIn** — official `linkedin-api-js-client`
is stale (last publish ~3 yrs) → hand-written REST matching the 4 existing connectors is better than a dead dep.
**Taboola** — no maintained npm SDK, REST only → hand-written. **Meta/Google/TikTok/Outbrain** (pre-existing)
are also hand-written dep-free by design, so the new ones match. Reuse was genuinely evaluated, not skipped.

Reuse sources index: `Desktop/HELIX - מאגר מקורות סקילים MCP ואייגנטים.docx`.
