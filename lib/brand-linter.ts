// Brand Linter v1 — Claude vision. Given an asset image + the workspace brand guide,
// returns structured violations (color / font / logo / disclaimer) + a compliance score.
// No native deps — works serverless. Deterministic pre-checks (color-thief) + robust OCR
// (MinerU) are a later strengthening layer.

const MODEL = process.env.VISION_MODEL || 'claude-sonnet-5';

export type BrandGuide = {
  colors: string[];
  fonts: string[];
  logo_url: string | null;
  disclaimers: string[];
  notes: string | null;
};

export type Violation = {
  type: 'color' | 'font' | 'logo' | 'disclaimer' | 'other';
  severity: 'high' | 'medium' | 'low';
  detail: string;
};

export type BrandCheckResult = { score: number; violations: Violation[] };

export async function runBrandCheck(imageUrl: string, guide: BrandGuide): Promise<BrandCheckResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('missing_api_key');

  const guideText = [
    `צבעי מותג (hex): ${guide.colors.join(', ') || '—'}`,
    `פונטים מותרים: ${guide.fonts.join(', ') || '—'}`,
    `דיסקליימרים חובה: ${guide.disclaimers.join(' | ') || '—'}`,
    `הערות: ${guide.notes || '—'}`,
  ].join('\n');

  const system =
    'אתה בודק עמידה בקווי מותג (brand compliance). קיבלת נכס שיווקי וקווי מותג. ' +
    'מצא חריגות: צבעים שלא בפלטה, פונט לא מתאים, שימוש שגוי או היעדר לוגו, וטקסט/דיסקליימר חובה שחסר. ' +
    'החזר JSON בלבד בפורמט: {"score": <0-100 עמידה במותג>, "violations":[{"type":"color|font|logo|disclaimer|other","severity":"high|medium|low","detail":"תיאור קצר בעברית"}]}. ' +
    'אם אין חריגות — violations ריק ו-score גבוה.';

  const user = `קווי המותג:\n${guideText}\n\nבדוק את התמונה המצורפת מול קווי המותג והחזר JSON בלבד.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image', source: { type: 'url', url: imageUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`vision_${res.status}`);

  const json = (await res.json()) as { content?: { text?: string }[] };
  const text = json.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { score: 0, violations: [] };
  try {
    const parsed = JSON.parse(match[0]) as { score?: number; violations?: Violation[] };
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      violations: Array.isArray(parsed.violations) ? parsed.violations : [],
    };
  } catch {
    return { score: 0, violations: [] };
  }
}
