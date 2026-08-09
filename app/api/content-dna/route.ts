import { NextResponse } from 'next/server';
import { analyzeDNA, type ContentDna } from '@/lib/performance/content-dna';

// Canned analysis of the built-in example posts — used only on localhost when no API key
// is configured, so the full result UI is visible without live inference.
const DEMO_DNA: ContentDna = {
  posts: [
    { index: 0, opener: 'סיפור אישי עם מספר ספציפי', topic: 'תוצאה שהקהל רוצה', format: 'שורות קצרות ללא רשימות', ending: 'שאלה פתוחה לדיון' },
    { index: 1, opener: 'הצהרה נועזת', topic: 'פעולה שנקטתי', format: 'שורות קצרות ללא רשימות', ending: 'שאלה פתוחה לדיון' },
    { index: 2, opener: 'שאלה פרובוקטיבית', topic: 'פעולה שנקטתי', format: 'שורות קצרות ללא רשימות', ending: 'שאלה פתוחה לדיון' },
  ],
  formula: { opener: 'הצהרה נועזת / סיפור אישי עם מספר', topic: 'פעולה שנקטתי', format: 'שורות קצרות', ending: 'שאלה פתוחה לדיון' },
  consistency: { opener: 2, topic: 2, format: 3, ending: 3, total: 3 },
  why: [
    'שבירת מוסכמות כבר בשורה הראשונה עוצרת את הגלילה ובונה אוטוריטה של מי שיודע משהו שאחרים לא.',
    'שילוב של פעולה אישית "מאחורי הקלעים" עם תוצאה מספרית הופך אמירה כללית להוכחת יכולת שיוצרת אמון.',
  ],
  template: {
    opener: '[הצהרה נועזת שמנפצת מוסכמה בתחום שלך].',
    topic: 'במשך הרבה זמן חשבתי ש[הפעולה הנפוצה] — עד ש[הפעולה החדשה שנקטתי].',
    format: 'התוצאה: [מספר ספציפי/הישג] בתוך [זמן קצר].',
    ending: 'מה הדבר הראשון שהייתם משנים ב[הנושא] אם הייתם יודעים שזה יעבוד?',
  },
};

// Local-preview endpoint for Content DNA — lets the card run the engine without a
// logged-in workspace while developing on localhost. Disabled in production (the real
// path is the auth-gated `analyzeContentDna` server action inside the Performance page).
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { posts?: unknown };
  const posts = Array.isArray(body.posts) ? (body.posts as string[]) : [];
  const dna = await analyzeDNA(posts);
  if (dna) return NextResponse.json({ ok: true, dna });
  // No ANTHROPIC_API_KEY on localhost → return a representative canned analysis so the full
  // result UI can be evaluated without a live key. Dev-only; flagged `demo` for the badge.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, demo: true, dna: DEMO_DNA });
  }
  return NextResponse.json({ error: 'missing_api_key' });
}
