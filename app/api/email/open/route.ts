import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// פיקסל פתיחה 1x1. מסמן פתיחה ומעדכן מונה קמפיין.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: Request) {
  try {
    const sendId = new URL(request.url).searchParams.get('s');
    const admin = createAdminClient();
    if (sendId && admin) {
      const { data: send } = await admin
        .from('email_sends')
        .select('id, campaign_id, opened_at')
        .eq('id', sendId)
        .maybeSingle();
      if (send && !send.opened_at) {
        await admin.from('email_sends').update({ opened_at: new Date().toISOString() }).eq('id', sendId);
        const { data: c } = await admin
          .from('email_campaigns')
          .select('opens')
          .eq('id', send.campaign_id)
          .maybeSingle();
        if (c) await admin.from('email_campaigns').update({ opens: (c.opens ?? 0) + 1 }).eq('id', send.campaign_id);
      }
    }
  } catch {
    // תמיד מחזירים פיקסל
  }
  return new Response(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
