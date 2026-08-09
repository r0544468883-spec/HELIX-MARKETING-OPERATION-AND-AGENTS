import { NextResponse } from 'next/server';
import { buildPost, handleEmail, type BuildInput, type EmailInput } from '@/lib/performance/content-tool';

// Local-preview endpoint for the Post Builder / Email tools — runs the engine without a
// logged-in workspace while developing on localhost. Disabled in production (the real path
// is the auth-gated buildPostAction / emailAction server actions).
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { mode?: string; build?: BuildInput; email?: EmailInput };
  if (body.mode === 'build') {
    const result = await buildPost((body.build ?? {}) as BuildInput);
    return result ? NextResponse.json({ ok: true, result }) : NextResponse.json({ error: 'missing_api_key' });
  }
  if (body.mode === 'email') {
    const result = await handleEmail((body.email ?? {}) as EmailInput);
    return result ? NextResponse.json({ ok: true, result }) : NextResponse.json({ error: 'missing_api_key' });
  }
  return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
}
