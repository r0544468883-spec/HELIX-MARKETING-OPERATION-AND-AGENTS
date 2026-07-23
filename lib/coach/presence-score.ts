// Presence Score — audits a PROFILE / presence (channel-aware) and returns a
// 0-100 score across weighted criteria + per-criterion fixes + prioritized top
// fixes. Works for social profiles (LinkedIn/Facebook/Instagram, personal &
// business) and the email-sender "profile" (SPF/DKIM/DMARC/warmup).
import { PRESENCE_CHANNELS, type PresenceChannel } from './rubrics';
import { coachLLM, parseJsonObject, weightedOverall } from './llm';

export type PresenceCriterion = { key: string; label: string; score: number; weight: number; status: 'good' | 'ok' | 'poor'; findings: string; fixes: string[] };
export type PresenceResult = {
  channel: PresenceChannel;
  channelLabel: string;
  overall: number;
  criteria: PresenceCriterion[];
  topFixes: string[];
  summary: string;
};

// `profile` is free-form: paste text, a JSON of fields, or a structured object the
// extension scraped. The model reads whatever is given and scores each criterion;
// missing data → low score for that criterion with a "add this" fix.
export type PresenceInput = { channel: PresenceChannel; profile: string | Record<string, unknown> };

function statusFor(score: number): 'good' | 'ok' | 'poor' {
  return score >= 8 ? 'good' : score >= 5 ? 'ok' : 'poor';
}

export async function scorePresence(input: PresenceInput): Promise<PresenceResult> {
  const cfg = PRESENCE_CHANNELS[input.channel];
  if (!cfg) throw new Error(`unknown_channel_${input.channel}`);

  const critList = cfg.criteria.map((c) => `- ${c.key} (${c.label}): ${c.hint}`).join('\n');
  const profileText = typeof input.profile === 'string' ? input.profile : JSON.stringify(input.profile, null, 2);

  const system = `אתה מומחה נוכחות-דיגיטלית ומיתוג אישי/עסקי, ישיר ולא-מתייפייף. אתה מאבחן פרופילים ונותן ציון וברור מה לתקן. אם מידע חסר בקלט — נקד נמוך לאותו קריטריון עם תיקון "הוסף/השלם". החזר JSON בלבד.`;
  const user = `ערוץ: ${cfg.label}
הקשר: ${cfg.note}

דרג כל קריטריון (score 0-10) עם status, findings קצר, וכמה fixes פרקטיים. בנוסף החזר topFixes (3-5 התיקונים בעלי ההשפעה הגבוהה ביותר, ממוינים) וסיכום קצר.

קריטריונים:
${critList}

נתוני הפרופיל שסופקו:
"""
${profileText}
"""

החזר JSON בלבד:
{
  "criteria": [ { "key": "...", "score": 0-10, "findings": "...", "fixes": ["..."] } ],
  "topFixes": ["...", "..."],
  "summary": "1-2 משפטים"
}`;

  const raw = await coachLLM(system, user, 2200);
  const parsed = parseJsonObject<{
    criteria?: { key: string; score: number; findings?: string; fixes?: string[] }[];
    topFixes?: string[];
    summary?: string;
  }>(raw) ?? {};

  const byKey = new Map((parsed.criteria ?? []).map((c) => [c.key, c]));
  const criteria: PresenceCriterion[] = cfg.criteria.map((c) => {
    const got = byKey.get(c.key);
    const score = Math.max(0, Math.min(10, Number(got?.score) || 0));
    return {
      key: c.key, label: c.label, weight: c.weight, score, status: statusFor(score),
      findings: got?.findings ?? '',
      fixes: Array.isArray(got?.fixes) ? got!.fixes!.slice(0, 4) : [],
    };
  });

  return {
    channel: input.channel,
    channelLabel: cfg.label,
    overall: weightedOverall(criteria),
    criteria,
    topFixes: Array.isArray(parsed.topFixes) ? parsed.topFixes.slice(0, 6) : [],
    summary: parsed.summary ?? '',
  };
}
