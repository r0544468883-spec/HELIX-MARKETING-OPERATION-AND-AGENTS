import 'server-only';
import { askJson } from './llm';

// Content DNA — one of the performance module's content tools. Given a handful of the
// operator's OWN posts that WORKED, it decomposes each into 4 recurring "genes"
// (opener / topic / format / ending), finds the shared FORMULA across them, explains why
// the audience responds, and emits a fill-in template so the next post is written on the
// winning pattern. Sibling to style-profile.ts (which learns campaign-naming conventions);
// here we learn the post-writing pattern. Claude-backed via askJson → degrades to null
// when there's no ANTHROPIC_API_KEY (caller shows the missing-key hint).

/** The 4 genes we break every post into. */
export type Genes = {
  opener: string;
  topic: string;
  format: string;
  ending: string;
};

export type PostDna = { index: number } & Genes;

export type ContentDna = {
  /** per-post breakdown, order matches the input posts */
  posts: PostDna[];
  /** the aggregate formula label per gene (the "most common / winning" variant) */
  formula: Genes;
  /** how consistent each gene is across the posts, e.g. { format: 3 } out of `total` */
  consistency: { opener: number; topic: number; format: number; ending: number; total: number };
  /** 2–3 short reasons the audience responds (the "why it works") */
  why: string[];
  /** a fill-in template the operator can complete for the next post */
  template: { opener: string; topic: string; format: string; ending: string };
};

const SYSTEM =
  'אתה אנליסט תוכן ישראלי שמפרק פוסטים מנצחים ל־DNA שלהם. ' +
  'קלט: כמה פוסטים (בעברית) שקיבלו תגובות טובות. ' +
  'פרק כל פוסט ל־4 גנים קצרים בעברית: opener (סוג הפתיח), topic (סוג הנושא/זווית), ' +
  'format (מבנה/פורמט), ending (סוג הסיום). כל תווית = 2–5 מילים, קונקרטית. ' +
  'אחר כך זהה את הנוסחה המשותפת (formula) — התווית הדומיננטית לכל גן, ' +
  'ספור עקביות (כמה פוסטים חולקים כל גן), כתוב 2–3 סיבות קצרות למה הקהל מגיב (why), ' +
  'ובנה template למילוי־חוסר לפוסט הבא לפי הנוסחה (שורות עם [סוגריים מרובעים] להשלמה). ' +
  'החזר JSON תקין בלבד, בעברית, במבנה: ' +
  '{"posts":[{"index":0,"opener":"","topic":"","format":"","ending":""}],' +
  '"formula":{"opener":"","topic":"","format":"","ending":""},' +
  '"consistency":{"opener":0,"topic":0,"format":0,"ending":0,"total":0},' +
  '"why":["",""],' +
  '"template":{"opener":"","topic":"","format":"","ending":""}}';

/**
 * Analyze 2–8 posts and return their shared Content DNA. Returns null when there's no
 * AI key or the model output can't be parsed — the caller falls back to a hint.
 */
export async function analyzeDNA(posts: string[]): Promise<ContentDna | null> {
  const clean = posts.map((p) => p.trim()).filter(Boolean).slice(0, 8);
  if (clean.length < 2) return null;

  const user =
    'הפוסטים לניתוח (ממוספרים מ־0):\n\n' +
    clean.map((p, i) => `### פוסט ${i}\n${p}`).join('\n\n');

  const dna = await askJson<ContentDna>(SYSTEM, user, 1400);
  if (!dna || !Array.isArray(dna.posts) || !dna.formula) return null;

  // Normalize: guarantee a total and clamp counts so the UI meters never over/underflow.
  const total = clean.length;
  const clamp = (n: unknown) => Math.max(0, Math.min(total, Number(n) || 0));
  return {
    ...dna,
    consistency: {
      opener: clamp(dna.consistency?.opener),
      topic: clamp(dna.consistency?.topic),
      format: clamp(dna.consistency?.format),
      ending: clamp(dna.consistency?.ending),
      total,
    },
    why: (dna.why ?? []).filter(Boolean).slice(0, 3),
  };
}
