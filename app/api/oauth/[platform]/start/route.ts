import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeUrl, isOAuthPlatform } from '@/lib/performance/oauth';

// Begin the ad-platform OAuth: resolve the current user's workspace, stash it + a random
// state in an httpOnly cookie, and redirect to the provider's consent screen. The callback
// reads the cookie back to know which workspace to attach the creds to.
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isOAuthPlatform(platform)) return new NextResponse('unsupported platform', { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/he/login', req.nextUrl.origin));
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  const ws = mem?.workspace_id as string | undefined;
  if (!ws) return new NextResponse('no workspace', { status: 400 });

  const redirectUri = `${req.nextUrl.origin}/api/oauth/${platform}/callback`;
  const state = crypto.randomUUID().replace(/-/g, '');
  const url = authorizeUrl(platform, redirectUri, state);
  if (!url) return new NextResponse('oauth not configured for this platform', { status: 503 });

  const res = NextResponse.redirect(url);
  // Short-lived, httpOnly — carries workspace + state through the round-trip.
  res.cookies.set('oauth_flow', JSON.stringify({ ws, platform, state }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
