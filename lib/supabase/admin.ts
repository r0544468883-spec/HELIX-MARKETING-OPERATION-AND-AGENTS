import { createClient } from '@supabase/supabase-js';

// קליינט service_role לפעולות שרת שעוקפות RLS (שליחת דיוור, מעקב, הסרה).
// דורש SUPABASE_SERVICE_ROLE_KEY. מחזיר null אם חסר.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
