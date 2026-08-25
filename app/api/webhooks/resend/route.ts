import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { suppress } from '@/lib/email-suppression';

export const dynamic = 'force-dynamic';

// Resend event webhook. On a hard bounce or spam complaint we add the address
// to the suppression list so it is never emailed again. Configure this URL in
// the Resend dashboard and set RESEND_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const provided =
    request.headers.get('x-webhook-secret') ??
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'config' }, { status: 500 });

  try {
    const event = (await request.json().catch(() => ({}))) as {
      type?: string;
      data?: { to?: string | string[]; email?: string };
    };
    const type = event.type ?? '';
    const raw = event.data?.to ?? event.data?.email;
    const emails = Array.isArray(raw) ? raw : raw ? [raw] : [];

    if (type === 'email.bounced') {
      for (const e of emails) await suppress(admin, e, 'bounce', 'resend');
    } else if (type === 'email.complained') {
      for (const e of emails) await suppress(admin, e, 'complaint', 'resend');
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
