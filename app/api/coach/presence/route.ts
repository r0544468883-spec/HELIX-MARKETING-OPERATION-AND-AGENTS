// POST /api/coach/presence — audit a profile/presence (channel-aware) → 0-100.
// Body: { channel, profile }  (profile = text or object of the profile fields)
//   channel ∈ linkedin | linkedin_company | facebook_profile | facebook_page |
//             instagram_profile | instagram_business | email_sender
import { NextResponse } from 'next/server';
import { scorePresence } from '@/lib/coach/presence-score';
import { PRESENCE_CHANNELS, type PresenceChannel } from '@/lib/coach/rubrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.channel || !b?.profile) return NextResponse.json({ error: 'channel and profile required' }, { status: 400 });
  if (!(b.channel in PRESENCE_CHANNELS)) {
    return NextResponse.json({ error: 'unknown channel', channels: Object.keys(PRESENCE_CHANNELS) }, { status: 400 });
  }
  try {
    const result = await scorePresence({ channel: b.channel as PresenceChannel, profile: b.profile });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({
    channels: Object.entries(PRESENCE_CHANNELS).map(([key, c]) => ({ key, label: c.label, criteria: c.criteria.map((d) => d.key) })),
  });
}
