import { NextResponse } from 'next/server';
import { extractVoiceProfile } from '@/lib/performance/voice';

// Local-preview endpoint for the voice engine — lets the Content DNA card learn a voice
// without a logged-in workspace while developing on localhost. Disabled in production
// (the real path is the auth-gated `learnVoice` server action, which also persists).
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { posts?: unknown };
  const posts = Array.isArray(body.posts) ? (body.posts as string[]) : [];
  const voice = await extractVoiceProfile(posts);
  if (voice) return NextResponse.json({ ok: true, voice });
  return NextResponse.json({ error: process.env.ANTHROPIC_API_KEY ? 'extraction_failed' : 'missing_api_key' });
}
