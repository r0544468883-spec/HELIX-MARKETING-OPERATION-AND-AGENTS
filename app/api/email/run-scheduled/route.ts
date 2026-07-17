import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverCampaign } from '@/app/actions';

export const dynamic = 'force-dynamic';

// שולח קמפיינים מתוזמנים שהגיע זמנם. נקרא ע"י Vercel Cron.
export async function GET(request: Request) {
  const secret = process.env.DIGEST_SECRET ?? process.env.CRON_SECRET;
  const url = new URL(request.url);
  const auth = request.headers.get('authorization');
  const provided = url.searchParams.get('secret') ?? auth?.replace('Bearer ', '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'missing config' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { data: due } = await admin
    .from('email_campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .limit(20);

  let total = 0;
  for (const campaign of (due ?? []) as Record<string, unknown>[]) {
    try {
      const locale = (campaign.locale_filter as string) || 'he';
      total += await deliverCampaign(admin, campaign, locale);
    } catch {
      // ממשיכים לקמפיין הבא
    }
  }

  return NextResponse.json({ ok: true, campaigns: (due ?? []).length, sent: total });
}
