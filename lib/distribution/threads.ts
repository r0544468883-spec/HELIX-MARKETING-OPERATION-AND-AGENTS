import type { ChannelConfig, SendResult } from './types';

// Threads (Meta) — config: { threads_user_id, access_token }. Two-step: create text container → publish.
export async function sendThreads(config: ChannelConfig, content: string): Promise<SendResult> {
  const userId = config.threads_user_id as string | undefined;
  const token = config.access_token as string | undefined;
  if (!userId || !token) return { ok: false, error: 'threads_not_configured' };
  const base = 'https://graph.threads.net/v1.0';
  try {
    const createRes = await fetch(
      `${base}/${userId}/threads?media_type=TEXT&text=${encodeURIComponent(content)}&access_token=${token}`,
      { method: 'POST' }
    );
    const createJson = (await createRes.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createJson.id) return { ok: false, error: createJson.error?.message ?? `threads_${createRes.status}` };

    const pubRes = await fetch(
      `${base}/${userId}/threads_publish?creation_id=${createJson.id}&access_token=${token}`,
      { method: 'POST' }
    );
    const pubJson = (await pubRes.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!pubRes.ok) return { ok: false, error: pubJson.error?.message ?? `threads_${pubRes.status}` };
    return { ok: true, externalId: pubJson.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
