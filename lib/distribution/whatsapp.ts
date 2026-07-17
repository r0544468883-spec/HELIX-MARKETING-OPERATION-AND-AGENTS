import type { ChannelConfig, SendResult } from './types';

// WhatsApp Cloud API (Meta) — config: { access_token, phone_number_id, recipients: string[] }
// Note: business-initiated messages outside the 24h window require an approved template.
// MVP sends a plain text message (valid inside an open 24h customer session).
export async function sendWhatsApp(config: ChannelConfig, content: string): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const phoneId = config.phone_number_id as string | undefined;
  const recipients = (config.recipients as string[] | undefined) ?? [];
  if (!token || !phoneId || recipients.length === 0) {
    return { ok: false, error: 'whatsapp_not_configured' };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipients[0],
        type: 'text',
        text: { body: content },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `whatsapp_${res.status}` };
    return { ok: true, externalId: json.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
