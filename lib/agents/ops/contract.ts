// HELIX OPS — internal agent department (charter §4b of HELIX-CHIEF-AND-AGENTS-SPEC).
// OPS auto-comments/DMs on other people's social profiles in the brand's name —
// a gray-path, brand-safety-critical action. The Maker (lib/engagement/engage-agent)
// drafts the copy; the Critic here challenges that draft BEFORE the autonomy switch
// is allowed to auto-post it. Mirrors Rank (gates publish) and Growth Doctor (gates
// auto-execute): a non-safe verdict downgrades autopilot → human approval.

export type CommentVerdict = 'post' | 'revise' | 'block';
export type CommentReview = {
  verdict: CommentVerdict;
  safeToAutoPost: boolean;   // may the autopilot cron post/send this with no human ✓?
  risks: string[];           // brand / spam / ToS / tone-of-context concerns
  note: string;              // one blunt sentence, no sugarcoating
};

// Budget Critic — vets a MONEY move (pause an ad / scale a budget +25%) before the
// performance engine applies it on autopilot. The scoring is already confidence-
// gated deterministically; this adds an adversarial sanity check (sample size,
// confounders, downside of the spend) before real money shifts.
export type BudgetVerdict = 'apply' | 'hold';
export type BudgetReview = {
  verdict: BudgetVerdict;
  safeToApply: boolean;      // may autopilot execute this pause/scale with no human ✓?
  concerns: string[];
  note: string;
};
