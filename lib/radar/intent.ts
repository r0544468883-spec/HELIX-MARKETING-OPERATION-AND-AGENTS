// Lead Radar intent scoring — "is this post someone looking to BUY my service now?"
// Distinct from topic relevance: a post can be on-topic but not a buying signal.
import { claude } from '../engagement/ai';

// Fast keyword prefilter — which of the radar's keywords appear in the post.
export function matchedKeywords(content: string, keywords: string[]): string[] {
  const lc = content.toLowerCase();
  return keywords.filter((k) => k.trim() && lc.includes(k.toLowerCase()));
}

// Buying-intent score 0..1 given the post + who the ideal customer is.
export async function scoreIntent(content: string, icp: string): Promise<number> {
  if (!content.trim()) return 0;
  const raw = await claude(
    'You score BUYING INTENT: is the author actively looking to buy/hire the service described, right now? ' +
      'Return ONLY a number 0..1. A person asking for a recommendation/quote/help = high; someone just discussing = low; an ad/promo = 0.',
    `Ideal customer we serve: ${icp || 'unspecified'}\n\nPost:\n${content}`,
    8
  );
  const n = parseFloat((raw.match(/[0-9]*\.?[0-9]+/) ?? ['0'])[0]);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
