// Researcher archetype (§4b) — reads the OTHER person's post BEFORE the bot writes
// a reply, so the comment is relevant and context-aware instead of generic. Picks
// the angle/tone and, crucially, flags a sensitive post (grief, complaint, crisis)
// so the team can tread carefully or skip. It analyses; it does not write.
import { claude } from '@/lib/engagement/ai';
import { parseJson } from '../json';
import { withSkills } from '../../../skills/registry';

export interface PostBrief {
  angle: string; // the most relevant, useful (non-salesy) angle to engage on
  tone: string; // the tone that fits this post
  sensitive: boolean; // grief / complaint / crisis / politics → tread carefully or skip
  hook: string; // a specific point in the post worth responding to honestly
}

export async function analyzePost(postText: string): Promise<PostBrief | null> {
  const system = `אתה חוקר-הקשר. לפני שהבוט מגיב על הפוסט של מישהו אחר, נתח את הפוסט וקבע איך נכון להגיב.
כללים:
- angle: הזווית הרלוונטית והמועילה ביותר (לא מכירתית).
- tone: הטון המתאים (מקצועי / חם / אמפתי / קליל).
- sensitive: true אם הפוסט רגיש (אבל, תלונה, משבר, פוליטיקה) — אז להגיב בזהירות רבה, ולעיתים עדיף לא להגיב.
- hook: נקודה ספציפית בפוסט להתייחס אליה בכנות.
- אל תמציא; הישען על הפוסט בלבד.
החזר JSON בלבד: {"angle":"","tone":"","sensitive":false,"hook":""}`;

  const raw = await claude(withSkills(system, ['social-engagement']), `הפוסט:\n"""${(postText || '').slice(0, 800)}"""`, 300);
  const p = parseJson<PostBrief>(raw);
  if (!p) return null;
  return {
    angle: typeof p.angle === 'string' ? p.angle : '',
    tone: typeof p.tone === 'string' ? p.tone : '',
    sensitive: p.sensitive === true,
    hook: typeof p.hook === 'string' ? p.hook : '',
  };
}
