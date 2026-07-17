import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://helix-stage.vercel.app';
const RESEND_FROM = process.env.RESEND_FROM ?? 'HELIX STAGE <onboarding@resend.dev>';

// דייג'סט שבועי — נקרא ע"י Vercel Cron (או ידנית עם ?secret=...).
// דורש: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, DIGEST_SECRET (או CRON_SECRET), NEXT_PUBLIC_SUPABASE_URL
export async function GET(request: Request) {
  const secret = process.env.DIGEST_SECRET ?? process.env.CRON_SECRET;
  const url = new URL(request.url);
  const auth = request.headers.get('authorization');
  const provided = url.searchParams.get('secret') ?? auth?.replace('Bearer ', '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'missing config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: launches } = await supabase
    .from('launches')
    .select('votes_count, products!inner(name, slug, tagline)')
    .gte('launch_date', weekAgo)
    .order('votes_count', { ascending: false })
    .limit(10);

  const { data: subs } = await supabase.from('newsletter_subscribers').select('email, locale');
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'no subscribers' });
  }

  const items = (launches ?? []).map((l: Record<string, unknown>) => {
    const p = (Array.isArray(l.products) ? l.products[0] : l.products) as {
      name: string;
      slug: string;
      tagline: string;
    };
    return { ...p, votes: l.votes_count as number };
  });

  const listText = items
    .map((p, i) => `${i + 1}. ${p.name} — ${p.tagline}\n   ${SITE_URL}/he/products/${p.slug} (${p.votes} הצבעות)`)
    .join('\n\n');

  const body = `ההשקות הבולטות של השבוע ב-HELIX STAGE:\n\n${listText || 'עוד אין השקות השבוע.'}\n\nלכל ההשקות: ${SITE_URL}/he/launches`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  for (const s of subs) {
    try {
      await resend.emails.send({
        from: RESEND_FROM,
        to: s.email,
        subject: 'הדייג׳סט השבועי — HELIX STAGE',
        text: body,
      });
      sent++;
    } catch {
      // ממשיכים לנרשם הבא
    }
  }

  return NextResponse.json({ ok: true, sent, launches: items.length });
}
