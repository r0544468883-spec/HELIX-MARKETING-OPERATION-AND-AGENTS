// DM Critic (archetype 3 — the adversary) — reviews an auto-generated DM reply
// BEFORE it is sent in the brand's name on an inbound Messenger/Instagram thread.
// Same gray-path shape as the comment critic, tuned for a 1:1 reply: don't send
// something spammy, off-brand, that over-promises, or that mishandles a sensitive
// or complaint message. Harsh, honest, direct.
import { claude } from '@/lib/engagement/ai';
import { parseJson } from '../json';
import type { CommentReview, CommentVerdict } from '../contract';
import { withSkills } from '../../../skills/registry';

export async function critiqueDm(reply: string, incoming: string): Promise<CommentReview | null> {
  const system = `אתה מבקר brand-safety קשוח לתשובות DM שהבוט עומד לשלוח אוטומטית בשם העסק בשיחה פרטית עם לקוח. תפקידך למצוא סיכון — לא לשבח. ברירת-מחדל: חשדנות.
כללים (מחייבים):
1. אם התשובה נשמעת ספאם, מכירתית-בוטה, עם הבטחות שהעסק לא בהכרח יכול לקיים, או לא-מקצועית → safeToAutoPost=false.
2. הקשר: אם ההודעה הנכנסת היא תלונה/כעס/נושא רגיש והתשובה טון-חירשת, מתגוננת או מזלזלת → verdict=block.
3. אם התשובה מתחייבת למחיר/זמינות/פרטים שאסור לבוט להתחייב עליהם → block.
4. אל תמציא בעיות; כל חשש מבוסס על הטקסט. היה כן בשני הכיוונים.
5. safeToAutoPost=true רק אם התשובה מקצועית, מדויקת, מנומסת ובטוחה לשליחה אוטומטית. בכל ספק — false (תעבור לאדם).
6. note = משפט אחד בוטה.
verdict: "block" (מסוכן/לא-הולם), "revise" (בסיס סביר אך צריך עין-אדם), "post" (בטוח לשליחה).
החזר JSON בלבד: {"verdict":"post|revise|block","safeToAutoPost":false,"risks":[],"note":""}`;

  const user = `ההודעה שהתקבלה מהלקוח:\n"""${(incoming || '').slice(0, 600)}"""\n\nהתשובה שהבוט עומד לשלוח:\n"""${reply}"""`;

  const raw = await claude(withSkills(system, ['social-engagement']), user, 350);
  const p = parseJson<{ verdict?: string; safeToAutoPost?: boolean; risks?: string[]; note?: string }>(raw);
  if (!p) return null;
  const verdict: CommentVerdict = p.verdict === 'post' || p.verdict === 'revise' ? p.verdict : 'block';
  return {
    verdict,
    safeToAutoPost: p.safeToAutoPost === true && verdict === 'post',
    risks: Array.isArray(p.risks) ? p.risks : [],
    note: typeof p.note === 'string' ? p.note : '',
  };
}
