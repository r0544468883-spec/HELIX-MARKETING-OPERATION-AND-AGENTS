import { claude } from '../engagement/ai';
import type { Section } from './types';

// Fill a template's placeholder text from the campaign brief/persona — keeps the
// SAME structure (block types + field shapes), only rewrites the copy in Hebrew.
export async function fillLandingContent(sections: Section[], brief: string): Promise<Section[]> {
  const raw = await claude(
    'אתה קופירייטר לדפי-נחיתה. קיבלת מבנה JSON של דף-נחיתה (בלוקים). החזר **את אותו JSON בדיוק** (אותם types ואותם שדות), אבל שכתב את כל הטקסטים בעברית משכנעת המותאמת לבריף. אל תוסיף/תסיר שדות. אל תיגע ב-video_url (השאר ריק). החזר JSON בלבד.',
    `בריף:\n${brief}\n\nמבנה:\n${JSON.stringify(sections)}`,
    2500
  );
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return sections;
    const parsed = JSON.parse(m[0]) as Section[];
    // Keep it safe: only accept if the block types line up with the template.
    if (Array.isArray(parsed) && parsed.length === sections.length && parsed.every((p, i) => p.type === sections[i].type)) return parsed;
    return sections;
  } catch {
    return sections;
  }
}
