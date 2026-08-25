// Clean-room email suppression core (from helix-email-campaigns skill).
// The one rule every sender must obey: never email someone who unsubscribed
// or hard-bounced. Used before EVERY send — bulk campaigns here, and 1:1
// outreach in SDR. Provider-agnostic; composes only Supabase.

import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const CHUNK = 200;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Return the set of emails (lowercased) that must NOT be sent to: anyone in
 * `email_suppression` (bounces/complaints) OR unsubscribed in
 * `newsletter_subscribers`. Checks both so existing unsubscribes are honored.
 */
export async function suppressedEmails(admin: Admin, emails: string[]): Promise<Set<string>> {
  const norm = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const blocked = new Set<string>();
  if (norm.length === 0) return blocked;

  for (const part of chunk(norm, CHUNK)) {
    const [sup, unsub] = await Promise.all([
      admin.from('email_suppression').select('email').in('email', part),
      admin
        .from('newsletter_subscribers')
        .select('email')
        .not('unsubscribed_at', 'is', null)
        .in('email', part),
    ]);
    for (const row of (sup.data ?? []) as { email: string }[]) blocked.add(row.email.toLowerCase());
    for (const row of (unsub.data ?? []) as { email: string }[]) blocked.add(row.email.toLowerCase());
  }
  return blocked;
}

/** Filter a recipient list down to addresses that are safe to email. */
export async function filterSuppressed<T extends { email: string }>(
  admin: Admin,
  recipients: T[]
): Promise<T[]> {
  const blocked = await suppressedEmails(
    admin,
    recipients.map((r) => r.email)
  );
  return recipients.filter((r) => !blocked.has(r.email.trim().toLowerCase()));
}

/** True if a single address is suppressed (for 1:1 sends). */
export async function isSuppressed(admin: Admin, email: string): Promise<boolean> {
  const blocked = await suppressedEmails(admin, [email]);
  return blocked.has(email.trim().toLowerCase());
}

/** Add an address to the suppression list (bounce/complaint/manual). Idempotent. */
export async function suppress(
  admin: Admin,
  email: string,
  reason: 'bounce' | 'complaint' | 'manual',
  source = 'system'
): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  await admin
    .from('email_suppression')
    .upsert({ email: clean, reason, source }, { onConflict: 'email', ignoreDuplicates: true });
}
