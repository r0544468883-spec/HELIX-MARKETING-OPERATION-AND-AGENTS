import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// הרשמה ציבורית מטופס מוטמע: מוסיף איש קשר לרשימה של היזם לפי subscribe_token.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body.token as string | undefined;
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const name = (body.name as string | undefined)?.trim() || null;

    if (!token || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }
    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'config' }, { status: 500 });

    const { data: owner } = await admin
      .from('profiles')
      .select('id')
      .eq('subscribe_token', token)
      .maybeSingle();
    if (!owner) return NextResponse.json({ error: 'notfound' }, { status: 404 });

    await admin
      .from('contacts')
      .upsert(
        { owner_id: owner.id, email, name, source: 'form' },
        { onConflict: 'owner_id,email', ignoreDuplicates: true }
      );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'failed' }, { status: 200 });
  }
}
