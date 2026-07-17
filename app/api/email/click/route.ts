import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// מעקב הקלקה + הפניה ליעד המקורי.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sendId = params.get('s');
  const target = params.get('u');

  const dest = target && /^https?:\/\//.test(target) ? target : process.env.NEXT_PUBLIC_SITE_URL ?? '/';

  try {
    const admin = createAdminClient();
    if (sendId && admin) {
      const { data: send } = await admin
        .from('email_sends')
        .select('id, campaign_id, clicked_at')
        .eq('id', sendId)
        .maybeSingle();
      if (send && !send.clicked_at) {
        await admin.from('email_sends').update({ clicked_at: new Date().toISOString() }).eq('id', sendId);
        const { data: c } = await admin
          .from('email_campaigns')
          .select('clicks')
          .eq('id', send.campaign_id)
          .maybeSingle();
        if (c) await admin.from('email_campaigns').update({ clicks: (c.clicks ?? 0) + 1 }).eq('id', send.campaign_id);
      }
    }
  } catch {
    // ממשיכים להפניה בכל מקרה
  }

  return NextResponse.redirect(dest);
}
