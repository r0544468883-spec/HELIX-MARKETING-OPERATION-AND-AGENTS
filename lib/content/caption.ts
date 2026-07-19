// Caption generation for the Media Auto-Ingest — writes a per-network caption
// from a media asset's description, conditioned on the client profile, and
// routes Hebrew through the shared Hebrew writing skill.
import { claude } from '../engagement/ai';
import { humanizeHe } from '../hebrew';

export type ClientProfile = {
  name?: string | null;
  audience?: string | null;
  voice?: string | null;
  dos_donts?: string | null;
  lang?: string | null;
};

// Per-network caption guidance (kept aligned with content-agent channel guides).
const NETWORK_GUIDE: Record<string, string> = {
  אינסטגרם: 'כיתוב אינסטגרם קצר וויזואלי + 3-5 האשטגים רלוונטיים.',
  פייסבוק: 'פוסט פייסבוק קליל שמזמין תגובות, 2-4 שורות.',
  לינקדאין: 'פוסט לינקדאין מקצועי שמעביר ערך/תובנה, בלי סופרלטיבים.',
  טלגרם: 'הודעת טלגרם תמציתית וברורה.',
  TikTok: 'כיתוב TikTok קצר עם hook בשנייה הראשונה.',
  X: 'פוסט קצר עד 280 תווים.',
};

export async function generateCaption(
  asset: { description?: string | null; topic?: string | null; title?: string | null },
  network: string,
  profile: ClientProfile | null
): Promise<string> {
  const guide = NETWORK_GUIDE[network] ?? 'כיתוב שיווקי קצר וברור.';
  const ctx = profile
    ? `לקוח: ${profile.name ?? ''}. קהל יעד: ${profile.audience ?? '-'}. טון/סגנון: ${profile.voice ?? '-'}. כללים: ${profile.dos_donts ?? '-'}.`
    : '';
  const system = `אתה קופירייטר. כתוב כיתוב עבור ${network}. ${guide} ${ctx} כתוב בעברית תקנית ואנושית. החזר אך ורק את הכיתוב.`;
  const user = `נושא: ${asset.topic ?? asset.title ?? ''}\nתיאור המדיה: ${asset.description ?? ''}`;

  const raw = await claude(system, user, 400);
  // Route Hebrew through the shared writing skill.
  return humanizeHe(raw);
}
