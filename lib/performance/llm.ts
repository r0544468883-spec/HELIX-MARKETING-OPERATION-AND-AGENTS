import 'server-only';
import { clean } from '@/lib/clean-text';

// Small shared Claude helper for the performance module (style learning + campaign
// builder). Plain fetch, no SDK — matches cold-start.ts / content-agent.ts. Returns a
// parsed JSON object, or null on missing key / API error / unparseable output, so every
// caller degrades cleanly (falls back to heuristics) instead of throwing.

const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-5';

type Block = { type: 'text'; text: string } | { type: 'image'; source: { type: 'url'; url: string } };

export async function askJson<T>(system: string, user: string | Block[], maxTokens = 900): Promise<T | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const content = typeof user === 'string' ? [{ type: 'text', text: user }] : user;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { text?: string }[] };
    // Strip invisible/watermark chars from the model output before parsing so every
    // prose field inside the JSON (post, email body, DNA labels…) comes out clean.
    const text = clean(json.content?.[0]?.text ?? '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
