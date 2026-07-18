// Comment-to-DM funnel matching + template rendering.
import type { CommentFunnel, TemplateVars } from '../engagement/types';

// Normalize for keyword matching (lowercase, strip punctuation/emoji edges, collapse spaces).
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find the first active funnel whose keyword appears in the comment on that post.
export function matchFunnel(
  funnels: CommentFunnel[],
  postId: string,
  commentText: string
): CommentFunnel | null {
  const words = new Set(normalize(commentText).split(' '));
  for (const f of funnels) {
    if (!f.active) continue;
    if (f.post_id && f.post_id !== postId) continue;
    const kw = normalize(f.keyword);
    // whole-word match on single-word keywords, substring for phrases
    const hit = kw.includes(' ') ? normalize(commentText).includes(kw) : words.has(kw);
    if (hit) return f;
  }
  return null;
}

// Render {{var}} placeholders from a vars map; unknown vars are left blank.
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([\p{L}\p{N}_]+)\s*\}\}/gu, (_, key: string) => vars[key] ?? '');
}
