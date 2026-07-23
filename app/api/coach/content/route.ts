// POST /api/coach/content — score a draft before publishing (channel-aware).
// Body: { channel, draft, subject?, goal?, audience? }
//   channel ∈ email | facebook_profile | facebook_page | facebook_group |
//             linkedin | linkedin_company | instagram
import { NextResponse } from 'next/server';
import { scoreContent } from '@/lib/coach/content-coach';
import { CONTENT_CHANNELS, type ContentChannel } from '@/lib/coach/rubrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.channel || !b?.draft) return NextResponse.json({ error: 'channel and draft required' }, { status: 400 });
  if (!(b.channel in CONTENT_CHANNELS)) {
    return NextResponse.json({ error: 'unknown channel', channels: Object.keys(CONTENT_CHANNELS) }, { status: 400 });
  }
  try {
    const result = await scoreContent({
      channel: b.channel as ContentChannel, draft: String(b.draft),
      subject: b.subject, goal: b.goal, audience: b.audience,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    channels: Object.entries(CONTENT_CHANNELS).map(([key, c]) => ({ key, label: c.label, dimensions: c.dims.map((d) => d.key) })),
  });
}
