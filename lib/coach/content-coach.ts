// Content Coach — scores a DRAFT before publishing (channel-aware) and returns a
// per-dimension breakdown, concrete fixes, an improved rewrite, and a best-time
// suggestion. Complements content-agent.ts's human-ness `aiScore` with a richer
// quality/engagement rubric (the "critique-before-publish" gate).
import { CONTENT_CHANNELS, type ContentChannel } from './rubrics';
import { coachLLM, parseJsonObject, weightedOverall } from './llm';

export type CoachDimension = { key: string; label: string; score: number; weight: number; findings: string; fixes: string[] };
export type ContentCoachResult = {
  channel: ContentChannel;
  channelLabel: string;
  overall: number;
  dimensions: CoachDimension[];
  bestTime: { suggestion: string; reason: string };
  improved: string;
  summary: string;
};

export type ContentCoachInput = {
  channel: ContentChannel;
  draft: string;
  subject?: string;      // email only
  goal?: string;         // e.g. "להביא הרשמות לוובינר"
  audience?: string;     // e.g. "מנהלי שיווק B2B"
};

export async function scoreContent(input: ContentCoachInput): Promise<ContentCoachResult> {
  const cfg = CONTENT_CHANNELS[input.channel];
  if (!cfg) throw new Error(`unknown_channel_${input.channel}`);

  const dimList = cfg.dims.map((d) => `- ${d.key} (${d.label}): ${d.hint}`).join('\n');
  const draftText = input.subject ? `נושא: ${input.subject}\n\n${input.draft}` : input.draft;

  const system = `אתה עורך-תוכן ומומחה שיווק ישראלי, ישיר ולא-מתייפייף, עם עין חדה ל-hook, engagement והמרה. אתה מדרג טיוטות לפי ערוץ ונותן תיקונים פרקטיים. החזר JSON בלבד.`;
  const user = `ערוץ: ${cfg.label}
הקשר-ערוץ: ${cfg.note}
${input.goal ? `מטרת התוכן: ${input.goal}\n` : ''}${input.audience ? `קהל יעד: ${input.audience}\n` : ''}
דרג את הטיוטה הבאה על כל אחד מהממדים (score 0-10), עם findings קצר וכמה fixes פרקטיים לכל ממד. בנוסף: המלצת best-time לפרסום בערוץ הזה (עם נימוק קצר), גרסה משופרת מלאה של הטיוטה, וסיכום קצר.

ממדים לדירוג:
${dimList}

טיוטה:
"""
${draftText}
"""

החזר JSON בלבד במבנה:
{
  "dimensions": [ { "key": "...", "score": 0-10, "findings": "...", "fixes": ["...", "..."] } ],
  "bestTime": { "suggestion": "...", "reason": "..." },
  "improved": "הגרסה המשופרת המלאה",
  "summary": "סיכום קצר ב-1-2 משפטים"
}`;

  const raw = await coachLLM(system, user, 2200);
  const parsed = parseJsonObject<{
    dimensions?: { key: string; score: number; findings?: string; fixes?: string[] }[];
    bestTime?: { suggestion?: string; reason?: string };
    improved?: string;
    summary?: string;
  }>(raw) ?? {};

  const byKey = new Map((parsed.dimensions ?? []).map((d) => [d.key, d]));
  const dimensions: CoachDimension[] = cfg.dims.map((d) => {
    const got = byKey.get(d.key);
    return {
      key: d.key, label: d.label, weight: d.weight,
      score: Math.max(0, Math.min(10, Number(got?.score) || 0)),
      findings: got?.findings ?? '',
      fixes: Array.isArray(got?.fixes) ? got!.fixes!.slice(0, 4) : [],
    };
  });

  return {
    channel: input.channel,
    channelLabel: cfg.label,
    overall: weightedOverall(dimensions),
    dimensions,
    bestTime: { suggestion: parsed.bestTime?.suggestion ?? '', reason: parsed.bestTime?.reason ?? '' },
    improved: parsed.improved ?? '',
    summary: parsed.summary ?? '',
  };
}
