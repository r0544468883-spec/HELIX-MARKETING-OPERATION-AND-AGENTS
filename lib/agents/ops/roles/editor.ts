// Editor archetype (§4b) — rewrites the drafted comment to fix the Critic's
// concerns while keeping it human, short, non-salesy and relevant to the post.
// Turns the Critic from a pure gate into a collaborator: draft → critique →
// revise, before the auto-post decision.
import { claude } from '@/lib/engagement/ai';
import { withSkills } from '../../../skills/registry';

export async function reviseComment(
  draft: string,
  risks: string[],
  postText: string,
  brandVoice: string,
): Promise<string | null> {
  const system = `אתה עורך תגובות סושיאל. שכתב את התגובה כך שתטפל בהערות המבקר, תישאר אנושית, קצרה (משפט-שניים), לא-מכירתית, ורלוונטית לפוסט. ${brandVoice} החזר אך ורק את התגובה המתוקנת.`;
  const user = `הערות לתיקון: ${risks.join('; ') || 'שפר טבעיות ורלוונטיות.'}

הפוסט:
"""${(postText || '').slice(0, 500)}"""

התגובה הנוכחית:
${draft}`;

  const out = await claude(withSkills(system, ['social-engagement', 'helix-brand-voice']), user, 250);
  const trimmed = out?.trim();
  return trimmed ? trimmed : null;
}
