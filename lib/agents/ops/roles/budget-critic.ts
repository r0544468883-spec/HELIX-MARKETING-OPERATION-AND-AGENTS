// Budget Critic (archetype 3 — the adversary) — reviews a money move (pause an ad
// or scale its budget +25%) BEFORE the performance engine applies it on autopilot.
// The Bayesian scorer already gates on statistical confidence; this is the second
// pair of eyes on the ONE thing that costs real money: is the sample really enough,
// is there a confounder, is the downside of being wrong (at this spend) acceptable?
import { claude } from '@/lib/engagement/ai';
import { parseJson } from '../json';
import type { BudgetReview, BudgetVerdict } from '../contract';
import { withSkills } from '../../../skills/registry';

export async function critiqueBudget(input: {
  action: string;         // 'pause' | 'scale_up'
  score: number;          // blended 0..100
  confidence: number;     // 0..1
  spend: number;          // recent spend on this creative
  reason: string;         // the engine's deterministic reason
  creativeName: string;
}): Promise<BudgetReview | null> {
  const system = `אתה מבקר קשוח לפעולות תקציב-מודעות שהמערכת עומדת לבצע אוטומטית (עצירת מודעה או הגדלת תקציב ב-25%). זה כסף אמיתי. תפקידך למצוא סיבה לא לבצע אוטומטית — לא לאשר. ברירת-מחדל: חשדנות.
כללים (מחייבים):
1. מדגם/מובהקות: אם ה-confidence נמוך, או שהמדגם/ההוצאה זעירים מכדי להסיק — safeToApply=false.
2. אסימטריית-סיכון: הגדלת תקציב על הוצאה כבר-גבוהה, או עצירת מודעה עם הוצאה משמעותית, מסוכנות יותר — דרוש ביטחון גבוה יותר.
3. confounders: מודעה שרק עלתה, עונתיות, או קפיצת-הוצאה חד-פעמית עלולות לזייף את הציון — במקרה כזה hold.
4. אל תמציא; הישען על המספרים והנימוק. היה כן: אם הכל תקין וברור — apply.
5. safeToApply=true רק כשהפעולה מובהקת, פרופורציונלית להוצאה, ובטוחה לביצוע אוטומטי. בכל ספק — false (יעבור לאישור-אדם).
6. note = משפט אחד בוטה.
verdict: "hold" (עצור לאישור-אדם) או "apply" (בטוח לביצוע אוטומטי).
החזר JSON בלבד: {"verdict":"apply|hold","safeToApply":false,"concerns":[],"note":""}`;

  const user = `מודעה: ${input.creativeName}
פעולה מוצעת: ${input.action}
ציון: ${input.score}/100 · ביטחון: ${(input.confidence * 100) | 0}% · הוצאה אחרונה: ${input.spend}
נימוק המערכת: ${input.reason}`;

  const raw = await claude(withSkills(system, ['cro-conversion', 'finance-metrics']), user, 300);
  const p = parseJson<{ verdict?: string; safeToApply?: boolean; concerns?: string[]; note?: string }>(raw);
  if (!p) return null;
  const verdict: BudgetVerdict = p.verdict === 'apply' ? 'apply' : 'hold';
  return {
    verdict,
    safeToApply: p.safeToApply === true && verdict === 'apply',
    concerns: Array.isArray(p.concerns) ? p.concerns : [],
    note: typeof p.note === 'string' ? p.note : '',
  };
}
