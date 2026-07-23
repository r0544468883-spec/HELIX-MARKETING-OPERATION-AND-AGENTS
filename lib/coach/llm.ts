// Shared Claude caller for the coach engines (content + presence). Mirrors the
// plain-fetch pattern in content-agent.ts (no SDK). Server-only.
const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-5';

export async function coachLLM(system: string, user: string, maxTokens = 1400): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('missing_api_key');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`claude_${res.status}`);
  const json = (await res.json()) as { content?: { text?: string }[] };
  return (json.content?.[0]?.text ?? '').trim();
}

export function parseJsonObject<T = Record<string, unknown>>(raw: string): T | null {
  try {
    const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    const body = fence ? fence[1] : (raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/** Weighted 0-10 dimension scores → overall 0-100. */
export function weightedOverall(items: { score: number; weight: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.weight, 0) || 1;
  const acc = items.reduce((s, i) => s + Math.max(0, Math.min(10, i.score)) * i.weight, 0);
  return Math.round((acc / (totalW * 10)) * 100);
}
