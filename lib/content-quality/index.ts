// Content-quality checks — orphan words (typographic widows) + AI-style emojis.
// Pure, deterministic, no I/O and no LLM (mirrors lib/performance/scoring.ts).
// Two failure modes that make copy read amateur / "AI-written":
//   1) orphan word — a heading/paragraph whose last line is a single lone word.
//   2) AI emoji    — decorative emojis sprinkled inside prose (a classic LLM tell).
// Accepts either HTML (block tags extracted) or plain text (split on blank lines),
// so it runs on rendered pages AND on raw channel drafts (lib/content-agent.ts).
// Result shape mirrors lib/brand-linter.ts ({ score, violations }).

export type ContentIssueType = 'orphan_word' | 'ai_emoji';

export type ContentViolation = {
  type: ContentIssueType;
  severity: 'high' | 'medium' | 'low';
  /** Short Hebrew description + fix. */
  detail: string;
  /** The offending snippet (heading/sentence). */
  snippet?: string;
};

export type ContentQualityResult = { score: number; violations: ContentViolation[] };

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const EMOJI_ALLOW = new Set(['™', '®', '©', 'ℹ']);
const BLOCK_RE = /<(h[1-4]|p|li|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function looksLikeHtml(s: string): boolean {
  return /<(h[1-4]|p|li|div|span|section|article|br)\b/i.test(s);
}

/** Break input into logical blocks: HTML block tags, or blank-line-separated paragraphs. */
function toBlocks(input: string): { text: string; isHeading: boolean; raw: string }[] {
  const blocks: { text: string; isHeading: boolean; raw: string }[] = [];
  if (looksLikeHtml(input)) {
    let m: RegExpExecArray | null;
    BLOCK_RE.lastIndex = 0;
    while ((m = BLOCK_RE.exec(input))) {
      blocks.push({ text: stripTags(m[2]), isHeading: /^h[1-4]$/i.test(m[1]), raw: m[2] });
    }
  } else {
    for (const para of input.split(/\n{2,}/)) {
      const line = para.trim();
      if (!line) continue;
      // A short standalone line (no terminal punctuation) reads as a heading.
      const isHeading = line.length <= 60 && !/[.!?:]$/.test(line) && !line.includes('\n');
      blocks.push({ text: line.replace(/\s+/g, ' '), isHeading, raw: para });
    }
  }
  return blocks;
}

function wordCount(text: string): number {
  const t = text.replace(/ /g, ' ').trim();
  return t ? t.split(/\s+/).length : 0;
}

function countEmojis(text: string): { count: number; unique: string[] } {
  const found = text.match(EMOJI_RE) ?? [];
  const kept = found.filter((e) => !EMOJI_ALLOW.has(e));
  return { count: kept.length, unique: [...new Set(kept)] };
}

/** Multi-word headings/paragraphs at risk of a lone last-line word, when the
 * source neither glues the last words (nbsp) nor declares text-wrap balance/pretty. */
export function detectOrphanWords(input: string, opts: { max?: number } = {}): ContentViolation[] {
  const max = opts.max ?? 20;
  const hasBalance = /text-wrap\s*:\s*balance/i.test(input);
  const hasPretty = /text-wrap\s*:\s*pretty/i.test(input);
  const out: ContentViolation[] = [];
  for (const b of toBlocks(input)) {
    if (out.length >= max) break;
    const words = wordCount(b.text);
    if (!words) continue;
    if (/ |&nbsp;/i.test(b.raw)) continue; // already glued
    if (b.isHeading) {
      if (hasBalance || words < 4) continue;
      out.push({
        type: 'orphan_word',
        severity: 'medium',
        detail: 'כותרת בסיכון למילה יתומה. פתרון: text-wrap: balance על הכותרות, או רווח קשיח (&nbsp;) בין שתי המילים האחרונות.',
        snippet: b.text.slice(0, 120),
      });
    } else {
      if (hasPretty || words < 14) continue;
      out.push({
        type: 'orphan_word',
        severity: 'low',
        detail: 'פסקה ארוכה בסיכון למילה יתומה. פתרון: p { text-wrap: pretty }.',
        snippet: b.text.slice(0, 120),
      });
    }
  }
  return out;
}

/** Emojis inside prose; mid-sentence emojis (the strongest AI tell) rate higher. */
export function detectAiEmojis(input: string, opts: { max?: number } = {}): ContentViolation[] {
  const max = opts.max ?? 20;
  const out: ContentViolation[] = [];
  for (const b of toBlocks(input)) {
    if (out.length >= max) break;
    const { count, unique } = countEmojis(b.text);
    if (!count) continue;
    const midSentence = /\S\s*\p{Extended_Pictographic}\s*\S/u.test(b.text);
    out.push({
      type: 'ai_emoji',
      severity: midSentence ? 'high' : 'medium',
      detail: `נמצאו ${count} אימוג׳ים (${unique.join(' ')}) בטקסט — סימן היכר של תוכן שנכתב ע״י AI. הסר או המר לאייקון קווי כדי שהתוכן ייראה מקצועי.`,
      snippet: b.text.slice(0, 140),
    });
  }
  return out;
}

function scoreFromViolations(violations: ContentViolation[]): number {
  const penalty = violations.reduce(
    (s, v) => s + (v.severity === 'high' ? 12 : v.severity === 'medium' ? 6 : 3),
    0,
  );
  return Math.max(0, Math.min(100, 100 - penalty));
}

/** Run both checks on a piece of content (HTML or plain text). */
export function checkContentQuality(input: string): ContentQualityResult {
  const violations = [...detectAiEmojis(input), ...detectOrphanWords(input)];
  return { score: scoreFromViolations(violations), violations };
}
