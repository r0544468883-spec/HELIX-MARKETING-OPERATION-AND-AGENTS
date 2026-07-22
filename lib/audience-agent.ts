// Audience segmentation (#2) — from the campaign brief/persona, propose distinct
// audience segments with Meta targeting (geo + age band) and a one-line angle for
// the right message per segment. Each segment becomes its own Meta ad set.
import { claude } from './engagement/ai';
import type { MetaAudience } from './distribution/paid';

export type SuggestedAudience = MetaAudience & { angle: string };

function parseJson<T>(raw: string, fallback: T): T {
  try { const m = raw.match(/\[[\s\S]*\]/); return m ? (JSON.parse(m[0]) as T) : fallback; } catch { return fallback; }
}

export async function suggestAudiences(brief: string, n = 3): Promise<SuggestedAudience[]> {
  const raw = await claude(
    `אתה אסטרטג מדיה. הצע ${n} קהלי-יעד שונים לקמפיין, כל אחד עם targeting של Meta ומסר-זווית מתאים. החזר JSON בלבד: array של אובייקטים {"name": string, "targeting": {"countries": ["IL"], "ageMin": number, "ageMax": number}, "angle": string}. בעברית. בלי טקסט נוסף.`,
    brief, 800
  );
  const parsed = parseJson<SuggestedAudience[]>(raw, []);
  return parsed
    .filter((a) => a && a.name)
    .slice(0, n)
    .map((a) => ({
      name: String(a.name),
      angle: String(a.angle ?? ''),
      targeting: {
        countries: a.targeting?.countries?.length ? a.targeting.countries : ['IL'],
        ageMin: a.targeting?.ageMin ?? 18,
        ageMax: a.targeting?.ageMax ?? 65,
      },
    }));
}
