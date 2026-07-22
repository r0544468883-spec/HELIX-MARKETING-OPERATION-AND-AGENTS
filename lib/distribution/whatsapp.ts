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

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * Send an APPROVED WhatsApp template — the compliant way to open a conversation
 * proactively (outside the 24h window). `params` fill the body {{1}},{{2}}… in order.
 * `urlButtonParam` fills a dynamic URL button suffix (e.g. a campaign/landing id).
 */
export async function sendWhatsAppTemplate(
  config: ChannelConfig,
  to: string,
  templateName: string,
  language: string,
  params: string[],
  urlButtonParam?: string,
): Promise<SendResult> {
  const token = config.access_token as string | undefined;
  const phoneId = config.phone_number_id as string | undefined;
  if (!token || !phoneId) return { ok: false, error: 'whatsapp_not_configured' };
  const components: Record<string, unknown>[] = [];
  if (params.length) {
    components.push({ type: 'body', parameters: params.map((t) => ({ type: 'text', text: t })) });
  }
  if (urlButtonParam) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: urlButtonParam }] });
  }
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: language }, ...(components.length ? { components } : {}) },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `whatsapp_${res.status}` };
    return { ok: true, externalId: json.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Register (create) a message template on the WABA. Idempotent-ish: duplicate name is treated as OK. */
export async function createWhatsAppTemplate(
  config: ChannelConfig,
  wabaId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; id?: string; error?: string; status?: string }> {
  const token = config.access_token as string | undefined;
  if (!token) return { ok: false, error: 'whatsapp_not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string; code?: number } };
    if (!res.ok) {
      // Duplicate template name → already exists → fine for our sync purpose.
      if (json.error?.message?.toLowerCase().includes('already exists')) return { ok: true, status: 'exists' };
      return { ok: false, error: json.error?.message ?? `waba_${res.status}` };
    }
    return { ok: true, id: json.id, status: json.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
