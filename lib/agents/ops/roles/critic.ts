// Critic (archetype 3 — the adversary) — reviews a draft comment/DM BEFORE the
// autonomy switch may auto-post it in the brand's name on someone else's post.
// This is the guard against the real gray-path risks: spammy/salesy replies that
// get the account flagged, tone-deaf comments on sensitive posts, off-brand copy.
// Harsh, honest, direct. Doubt counts against posting.
import { claude } from '@/lib/engagement/ai';
import type { CommentReview } from '../contract';
import { parseJson } from '../json';

export async function critique(
  draft: string,
  postText: string,
  brandVoice: string,
): Promise<CommentReview | null> {
  const system = `אתה מבקר brand-safety קשוח וישיר. הבוט עומד לפרסם תגובה אוטומטית, בשם העסק, על הפוסט של מישהו אחר. תפקידך למצוא סיכון — לא לשבח. ברירת-מחדל: חשדנות.
כללים (מחייבים):
1. סיכון פלטפורמה/ToS: תגובה שנשמעת ספאם, מכירתית-בוטה, עם קישור/פרומו, או גנרית-מדביקה שעלולה לסמן/לחסום את החשבון → safeToAutoPost=false.
2. הקשר: אם הפוסט רגיש (אבל, תלונה, משבר, פוליטיקה) והתגובה טון-חירשת או מנצלת → verdict=block.
3. מותג: סטייה מקול-המותג, הבטחות-יתר, או טון לא-מקצועי → revise/block.
4. אל תמציא סיכונים; כל חשש חייב להתבסס על הטקסט או ההקשר. היה כן בשני הכיוונים.
5. safeToAutoPost=true אך ורק אם התגובה אנושית, רלוונטית לפוסט, לא-מכירתית, ובטוחה לפרסום אוטומטי בשם העסק. בכל ספק — false (תעבור לאישור-אדם).
6. note = משפט אחד בוטה על התגובה.
verdict: "block" (מסוכן/לא-הולם), "revise" (בסיס סביר אך צריך תיקון או עין-אדם), "post" (בטוח לפרסום אוטומטי).
החזר JSON בלבד: {"verdict":"post|revise|block","safeToAutoPost":false,"risks":[],"note":""}`;

  const user = `קול-מותג: ${brandVoice}\n\nהפוסט של האדם האחר:\n"""${(postText || '').slice(0, 800)}"""\n\nהתגובה שהבוט מתכוון לפרסם:\n"""${draft}"""`;

  const raw = await claude(system, user, 400);
  return parseJson<CommentReview>(raw);
}
