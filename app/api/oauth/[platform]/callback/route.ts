import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exchangeCode, isOAuthPlatform, OAUTH_CHANNEL } from '@/lib/performance/oauth';

// OAuth callback: verify the state cookie, exchange the code for creds, and MERGE them
// into the workspace's channel_connections.config for that platform (keeping any manually
// entered fields like developer_token/customer_id). Then bounce back to /performance.
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const back = (msg: string) => NextResponse.redirect(new URL(`/he/performance?connect=${platform}&status=${msg}`, req.nextUrl.origin));
  if (!isOAuthPlatform(platform)) return new NextResponse('unsupported platform', { status: 400 });

  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const raw = req.cookies.get('oauth_flow')?.value;
  if (!code || !state || !raw) return back('missing');

  let flow: { ws?: string; platform?: string; state?: string };
  try { flow = JSON.parse(raw); } catch { return back('badstate'); }
  if (flow.platform !== platform || flow.state !== state || !flow.ws) return back('badstate');

  const redirectUri = `${req.nextUrl.origin}/api/oauth/${platform}/callback`;
  const creds = await exchangeCode(platform, code, redirectUri);
  if (!creds) return back('exchange_failed');

  const supabase = await createClient();
  const channel = OAUTH_CHANNEL[platform];
  // Merge onto any existing config so manual fields survive a re-connect.
  const { data: existing } = await supabase.from('channel_connections').select('config').eq('workspace_id', flow.ws).eq('channel', channel).maybeSingle();
  const merged = { ...(existing?.config as Record<string, unknown> | null ?? {}), ...creds };
  const { error } = await supabase.from('channel_connections').upsert(
    { workspace_id: flow.ws, channel, config: merged, active: true },
    { onConflict: 'workspace_id,channel' }
  );

  const res = back(error ? 'save_failed' : 'connected');
  res.cookies.delete('oauth_flow');
  return res;
}
