import 'server-only';
import { askJson } from './llm';
import type { Genes } from './content-dna';
import { voicePromptBlock, type VoiceProfile } from './voice';

// Post builder + email writer/rewriter — the two content tools that sit next to Content DNA
// inside the Performance module. Same Claude-backed pattern (askJson → null on no key).
// Mirrors the site's /free-tools/content engine so web and OPS stay in sync.

// ── build a post ─────────────────────────────────────────────────────────────
export type BuildInput = {
  topic: string;
  platform?: string;
  tone?: string;
  language?: 'he' | 'en';
  formula?: Partial<Genes> | null;
  voice?: VoiceProfile | null; // the operator's own writing voice (from voice.ts) — few-shot style anchors
};
export type BuildResult = { post: string; hooks: string[] };

export async function buildPost(input: BuildInput): Promise<BuildResult | null> {
  const topic = (input.topic ?? '').trim();
  if (!topic) return null;
  const lang = input.language === 'en' ? 'English' : 'Hebrew';
  const formulaLine = input.formula
    ? `עקוב אחרי הנוסחה: פתיח=${input.formula.opener ?? ''}, נושא=${input.formula.topic ?? ''}, פורמט=${input.formula.format ?? ''}, סיום=${input.formula.ending ?? ''}.`
    : 'בחר את המבנה הכי אפקטיבי לפלטפורמה.';
  // The operator's own voice (if a profile was supplied) overrides the generic "authentic" default.
  const voiceLine = voicePromptBlock(input.voice, input.language !== 'en');
  const system =
    `You are an elite ${lang} social copywriter who writes posts that sound like a real human, never like AI. ` +
    `Write for ${input.platform || 'general social'}. Tone: ${input.tone || 'authentic, direct'}. ` +
    `${formulaLine} כתוב תוכן טבעי, בלי קלישאות AI ובלי אימוג'ים מוגזמים. ` +
    (voiceLine ? voiceLine + ' ' : '') +
    'Return ONLY JSON: {"post":"the full post text","hooks":["3 alternative opening-line hooks"]}';
  const r = await askJson<BuildResult>(system, `הנושא: ${topic}`, 1200);
  if (!r?.post) return null;
  return { post: r.post, hooks: (r.hooks ?? []).slice(0, 3) };
}

// ── write / rewrite an email ──────────────────────────────────────────────────
export type EmailInput = {
  action: 'write' | 'rewrite';
  language: 'he' | 'en';
  text: string;
  tone?: string;
  goal?: string;
};
export type EmailResult = { subject: string; body: string };

export async function handleEmail(input: EmailInput): Promise<EmailResult | null> {
  const text = (input.text ?? '').trim();
  if (!text) return null;
  const isEn = input.language === 'en';
  const langName = isEn ? 'English' : 'Hebrew';
  const rtlNote = isEn ? '' : 'כתוב עברית תקנית וטבעית, לא מתורגמת. ';
  const toneLine = input.tone ? `Tone: ${input.tone}. ` : '';
  const goalLine = input.goal ? `Context/goal: ${input.goal}. ` : '';
  const system =
    input.action === 'rewrite'
      ? `You rewrite emails in ${langName} to be clearer, warmer and more effective, keeping intent. ${rtlNote}${toneLine}${goalLine}Return ONLY JSON: {"subject":"","body":""}`
      : `You write high-converting ${langName} emails from a short brief. ${rtlNote}${toneLine}${goalLine}Return ONLY JSON: {"subject":"","body":""}`;
  const user = input.action === 'rewrite' ? `שכתב את המייל:\n\n${text}` : `כתוב מייל על סמך התיאור:\n\n${text}`;
  const r = await askJson<EmailResult>(system, user, 1200);
  if (!r?.body) return null;
  return { subject: r.subject ?? '', body: r.body };
}
