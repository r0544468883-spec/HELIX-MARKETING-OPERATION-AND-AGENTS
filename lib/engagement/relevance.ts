// Fuzzy relevance scoring — "is this post close enough to engage with?"
// LLM-based (no embeddings dependency), returns 0..1.
import { claude } from './ai';

export async function scoreRelevance(postText: string, topics: string[]): Promise<number> {
  if (!postText.trim() || topics.length === 0) return 0;
  const raw = await claude(
    'You score how relevant a social post is to a brand\'s topics. Return ONLY a number between 0 and 1 (e.g., 0.82). No words.',
    `Brand topics: ${topics.join(', ')}\n\nPost:\n${postText}`,
    8
  );
  const n = parseFloat((raw.match(/[0-9]*\.?[0-9]+/) ?? ['0'])[0]);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Default threshold — "close enough", not exact match.
export const RELEVANCE_THRESHOLD = 0.72;
