import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSource } from '@/lib/attribution';

export const dynamic = 'force-dynamic';

// רישום אירוע צפייה/המרה. נקרא מ-TrackView בצד לקוח (anon insert).
export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return NextResponse.json({ ok: false }, { status: 200 });

    const body = await request.json().catch(() => ({}));
    const productId = body.productId as string | undefined;
    if (!productId) return NextResponse.json({ ok: false }, { status: 200 });

    const event = body.event === 'beta_click' ? 'beta_click' : 'view';
    const surface = body.surface === 'landing' ? 'landing' : 'product';
    const source = normalizeSource(body.source, body.referrer);
    const sessionHash = typeof body.sessionHash === 'string' ? body.sessionHash.slice(0, 40) : null;

    const supabase = createClient(url, anon);
    await supabase.from('product_views').insert({
      product_id: productId,
      event,
      source,
      surface,
      session_hash: sessionHash,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
