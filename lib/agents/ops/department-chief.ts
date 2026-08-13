// Department Chief for OPS engagement (charter §4b). Given a drafted comment/DM
// and its context, runs the Critic and returns the review that gates auto-posting.
// The Maker (lib/engagement/engage-agent::generateComment) drafts; this only
// decides whether it is safe to auto-post without a human ✓.
import { critique } from './roles/critic';
import type { CommentReview } from './contract';

// Conservative default when the Critic can't be reached: never auto-post in the
// brand's name un-reviewed — hold for human approval (mirrors Rank/Growth Doctor:
// absent critic → safe path, no surprise action).
const HELD: CommentReview = {
  verdict: 'revise',
  safeToAutoPost: false,
  risks: ['המבקר לא זמין'],
  note: 'המבקר לא זמין — לא מפרסם אוטומטית, מעביר לאישור אדם.',
};

export async function reviewComment(
  draft: string,
  postText: string,
  brandVoice: string,
): Promise<CommentReview> {
  if (!draft.trim()) {
    return { verdict: 'block', safeToAutoPost: false, risks: ['טיוטה ריקה'], note: 'טיוטה ריקה — אין מה לפרסם.' };
  }
  const review = await critique(draft, postText, brandVoice).catch(() => null);
  return review ?? HELD;
}
