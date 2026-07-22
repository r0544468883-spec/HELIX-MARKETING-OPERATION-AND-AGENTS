import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Landing lead capture — store the lead AND feed attribution (mkt_visitors) so the
// conversion ties back to the campaign/UTM. This closes the ad → LP → conversion loop.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = (await req.json().catch(() => ({}))) as { fields?: Record<string, string>; utm?: Record<string, string> };
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'no_admin' }, { status: 500 });

  const { data: lp } = await admin.from('landing_pages').select('id, workspace_id, campaign_id').eq('slug', slug).eq('published', true).maybeSingle();
  if (!lp) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await admin.from('landing_leads').insert({ landing_id: lp.id, workspace_id: lp.workspace_id, fields: body.fields ?? {}, utm: body.utm ?? {} });

  // Attribution: upsert a converted visitor (best-effort; mkt_visitors from the coach-kit harvest).
  const utm = body.utm ?? {};
  const email = (body.fields?.email || '').toLowerCase().trim();
  try {
    await admin.from('mkt_visitors').insert({
      workspace_id: lp.workspace_id, visitor_id: `lp_${slug}_${email || Date.now()}`,
      utm_source: utm.utm_source ?? null, utm_medium: utm.utm_medium ?? null, utm_campaign: utm.utm_campaign ?? null,
      payment_status: 'lead', page_url: `/lp/${slug}`,
    });
  } catch { /* attribution optional */ }

  return NextResponse.json({ ok: true });
}
