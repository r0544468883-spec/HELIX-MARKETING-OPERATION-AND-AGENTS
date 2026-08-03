import 'server-only';

// Cold-start scorer — the AI PRIOR. Before a creative has any spend it has no data,
// so a multimodal-ish model reads the creative itself (platform, format, headline,
// body, hook) and predicts its 0..100 potential for the chosen objective. This is
// what decides which creatives launch and their initial budget; live data takes over
// via the Bayesian blend (see scoring.ts) as soon as it arrives.
//
// Plain fetch, no SDK — matches lib/content-agent.ts. Server-only (ANTHROPIC_API_KEY).

import type { Metric } from './scoring';

const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-5';

export type CreativeInput = {
  platform: string; // 'Meta' | 'TikTok' | 'Google' | 'Outbrain' | ...
  format?: string; // 'video' | 'image' | 'carousel' | 'text' ...
  headline?: string;
  body?: string;
  hook?: string; // first 3s / opening line
  mediaUrl?: string; // if present and an image, sent for multimodal scoring
};

export type ColdStartResult = { score: number; reasoning: string };

const METRIC_GOAL: Record<Metric, string> = {
  cpa: 'low cost per acquisition (purchases)',
  cpl: 'low cost per lead',
  roas: 'high return on ad spend',
  ctr: 'high click-through rate',
};

const FALLBACK: ColdStartResult = { score: 50, reasoning: 'no_ai_prior' };

/**
 * Score a single creative's potential 0..100 for `metric` on its platform.
 * Degrades to a neutral 50 (no key / API error) so the pipeline never blocks —
 * a neutral prior just means the blend leans on data sooner.
 */
export async function coldStartScore(c: CreativeInput, metric: Metric): Promise<ColdStartResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return FALLBACK;

  const system =
    'You are a senior performance-marketing creative strategist. Predict how a single ' +
    'ad creative will perform, BEFORE it runs, for a specific platform and objective. ' +
    'Judge hook strength, platform-format fit, clarity of value, CTA, and scroll-stopping ' +
    'power. Return ONLY strict JSON: {"score": <integer 1-100>, "reasoning": "<one short sentence>"}. ' +
    'Be calibrated: 50 is average, 80+ is exceptional, <30 is weak. No prose outside JSON.';

  const details = [
    `Platform: ${c.platform}`,
    c.format && `Format: ${c.format}`,
    `Objective: ${METRIC_GOAL[metric]}`,
    c.hook && `Hook/opening: ${c.hook}`,
    c.headline && `Headline: ${c.headline}`,
    c.body && `Body: ${c.body}`,
  ]
    .filter(Boolean)
    .join('\n');

  // Multimodal when we have an image URL — the visual is half the signal.
  const content: unknown[] = [{ type: 'text', text: `Score this creative:\n${details}` }];
  if (c.mediaUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(c.mediaUrl)) {
    content.unshift({ type: 'image', source: { type: 'url', url: c.mediaUrl } });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) return FALLBACK;
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as {
      score?: number;
      reasoning?: string;
    };
    const score = Math.round(Number(parsed.score));
    if (!Number.isFinite(score)) return FALLBACK;
    return { score: Math.min(100, Math.max(1, score)), reasoning: parsed.reasoning ?? '' };
  } catch {
    return FALLBACK;
  }
}
