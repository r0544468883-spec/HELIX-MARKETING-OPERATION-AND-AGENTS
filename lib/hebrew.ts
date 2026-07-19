// Shared Hebrew writing skill — the single humanize/proofread pass every
// content loop routes through (baldiga-style). Keeps Hebrew output sounding
// like a native Israeli human, not AI. Server-only.
import { claude } from './engagement/ai';

const HE = /[֐-׿]/;

export function isHebrew(text: string): boolean {
  return HE.test(text);
}

// Humanize + proofread Hebrew. No-op for non-Hebrew text.
export async function humanizeHe(text: string): Promise<string> {
  if (!text.trim() || !isHebrew(text)) return text;
  try {
    return await claude(
      'אתה עורך עברית מוביל. שכתב את הטקסט כך שיישמע אנושי-ישראלי טבעי לחלוטין (לא כמו בינה מלאכותית), ' +
        'ותקן כל שגיאת כתיב או דקדוק. שמור על המשמעות, הטון והאורך. החזר אך ורק את הטקסט המתוקן.',
      text,
      600
    );
  } catch {
    return text; // never block the loop on the humanize pass
  }
}
