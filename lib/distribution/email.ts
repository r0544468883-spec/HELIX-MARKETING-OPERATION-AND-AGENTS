import { Resend } from 'resend';
import type { ChannelConfig, SendResult } from './types';

// Email via Resend — config: { from?, recipients: string[], subject? }
export async function sendEmail(config: ChannelConfig, content: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const recipients = (config.recipients as string[] | undefined) ?? [];
  if (!key || recipients.length === 0) return { ok: false, error: 'email_not_configured' };

  const from =
    (config.from as string | undefined) ||
    process.env.RESEND_FROM ||
    'HELIX OPS <onboarding@resend.dev>';
  const subject = (config.subject as string | undefined) || 'עדכון מ-HELIX';

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({ from, to: recipients, subject, text: content });
    if (error) return { ok: false, error: error.message };
    return { ok: true, externalId: data?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
