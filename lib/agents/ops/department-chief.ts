// Department Chief for OPS engagement (charter §4b). Given a drafted comment/DM
// and its context, runs the Critic and returns the review that gates auto-posting.
// The Maker (lib/engagement/engage-agent::generateComment) drafts; this only
// decides whether it is safe to auto-post without a human ✓.
import { critique } from './roles/critic';
import { critiqueDm } from './roles/dm-critic';
import { critiqueBudget } from './roles/budget-critic';
import { analyzePost } from './roles/researcher';
import { reviseComment } from './roles/editor';
import { generateComment } from '@/lib/engagement/engage-agent';
import type { CommentReview, BudgetReview } from './contract';

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

// The engagement department (§4b): Researcher (read the post/context) → Maker
// (generateComment, guided by the brief) → Critic (brand-safety) → Editor (revise
// once if flagged). Returns the improved comment + the final auto-post verdict.
export async function composeEngagement(
  postText: string,
  brandVoice: string,
): Promise<{ comment: string; review: CommentReview }> {
  const brief = await analyzePost(postText).catch(() => null);
  const voice = brief
    ? `${brandVoice} זווית: ${brief.angle}. טון: ${brief.tone}.${brief.sensitive ? ' הפוסט רגיש — הגב בזהירות רבה, ואם אין ערך אמיתי עדיף לא להגיב.' : ''}`
    : brandVoice;

  let comment = (await generateComment(postText, voice).catch(() => '')) ?? '';
  let review = await reviewComment(comment, postText, brandVoice);

  if (comment.trim() && !review.safeToAutoPost) {
    const revised = await reviseComment(comment, review.risks, postText, brandVoice).catch(() => null);
    if (revised) {
      comment = revised;
      review = await reviewComment(comment, postText, brandVoice);
    }
  }
  return { comment, review };
}

// Review an auto-generated DM reply before it is sent in the brand's name.
export async function reviewDmReply(reply: string, incoming: string): Promise<CommentReview> {
  if (!reply.trim()) {
    return { verdict: 'block', safeToAutoPost: false, risks: ['תשובה ריקה'], note: 'תשובה ריקה — אין מה לשלוח.' };
  }
  const review = await critiqueDm(reply, incoming).catch(() => null);
  return review ?? HELD;
}

// Conservative default for money moves: an unreachable Critic holds the action for
// human approval — never auto-shifts ad budget un-reviewed.
const HELD_BUDGET: BudgetReview = {
  verdict: 'hold',
  safeToApply: false,
  concerns: ['המבקר לא זמין'],
  note: 'המבקר לא זמין — לא מבצע שינוי תקציב אוטומטית, מעביר לאישור אדם.',
};

// Review a pause/scale money move before the performance engine applies it.
export async function reviewBudgetDecision(input: {
  action: string;
  score: number;
  confidence: number;
  spend: number;
  reason: string;
  creativeName: string;
}): Promise<BudgetReview> {
  const review = await critiqueBudget(input).catch(() => null);
  return review ?? HELD_BUDGET;
}
