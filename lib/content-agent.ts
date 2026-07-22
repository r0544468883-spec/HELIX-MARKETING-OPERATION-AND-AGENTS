// Content Agent — orchestrates per-channel content generation with Claude:
//   1) draft with a channel-specific "skill" prompt (language auto by channel)
//   2) Hebrew branch: humanize + proofread ("Hebrew Content by Helix")
//   3) AI-detection score (0-100 human-ness) — the gate signal
// Server-only (reads ANTHROPIC_API_KEY). No SDK dependency — plain fetch.

const MODEL = process.env.CONTENT_MODEL || 'claude-sonnet-5';

type Lang = 'he' | 'en';

// Per-channel skill guidance. Hebrew channels → he; global/niche → en.
const CHANNEL_GUIDE: Record<string, { lang: Lang; guide: string }> = {
  'וואטסאפ': { lang: 'he', guide: 'הודעת וואטסאפ אישית, קצרה וחמה. אימוג׳י אחד לכל היותר. פנייה ישירה.' },
  'פייסבוק': { lang: 'he', guide: 'פוסט פייסבוק קליל שמזמין תגובות, 2-4 שורות.' },
  'אינסטגרם': { lang: 'he', guide: 'כיתוב אינסטגרם קצר וויזואלי + 3-5 האשטגים רלוונטיים.' },
  'לינקדאין': { lang: 'he', guide: 'פוסט לינקדאין מקצועי שמעביר ערך/תובנה, בלי סופרלטיבים.' },
  'טלגרם': { lang: 'he', guide: 'הודעת טלגרם תמציתית וברורה.' },
  'מייל': { lang: 'he', guide: 'מייל שיווקי קצר עם כותרת מושכת ו-CTA אחד ברור.' },
  'Reddit': { lang: 'en', guide: 'Authentic Reddit post — value-first, community tone, NOT promotional.' },
  'Medium': { lang: 'en', guide: 'Substantive Medium intro — a few paragraphs, depth over hype.' },
  'X': { lang: 'en', guide: 'Punchy X/Twitter post under 280 characters.' },
  'Discord': { lang: 'he', guide: 'הודעת Discord קהילתית, ידידותית וקצרה.' },
  'Slack': { lang: 'he', guide: 'הודעת Slack תמציתית וברורה לצוות.' },
  'Mastodon': { lang: 'en', guide: 'Short, authentic Mastodon post; community tone, no hype.' },
  'Bluesky': { lang: 'en', guide: 'Punchy Bluesky post under 300 characters.' },
  'Threads': { lang: 'en', guide: 'Casual, conversational Threads post; a few short lines.' },
  'WordPress': { lang: 'he', guide: 'פוסט בלוג — כותרת + פסקאות מהותיות, טון מקצועי.' },
  'Hashnode': { lang: 'en', guide: 'Technical Hashnode article intro — clear, developer-focused, markdown.' },
  'Pinterest': { lang: 'en', guide: 'Pin description — keyword-rich, inspiring, 1-2 sentences.' },
  'Google My Business': { lang: 'he', guide: 'עדכון עסקי מקומי קצר עם CTA (למשל "בקרו אותנו").' },
  'Warpcast': { lang: 'en', guide: 'Farcaster cast under 320 chars; crypto/tech-native, no fluff.' },
  'Lemmy': { lang: 'en', guide: 'Community Lemmy post — value-first, not promotional.' },
  'VK': { lang: 'en', guide: 'Short VK wall post, friendly and clear.' },
  'TikTok': { lang: 'he', guide: 'סקריפט/כיתוב לסרטון TikTok — קצר, קולע, hook בשנייה הראשונה.' },
  'YouTube': { lang: 'he', guide: 'כותרת + תיאור לסרטון YouTube — מושך, עם מילות מפתח.' },
  'Nostr': { lang: 'en', guide: 'Short Nostr note; authentic, decentralized-community tone.' },
};

async function claude(system: string, user: string, maxTokens = 800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('missing_api_key');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`claude_${res.status}`);
  const json = (await res.json()) as { content?: { text?: string }[] };
  return (json.content?.[0]?.text ?? '').trim();
}

export type ChannelDraft = { body: string; language: Lang; aiScore: number };

export async function generateChannelDraft(
  brief: string,
  title: string,
  channel: string
): Promise<ChannelDraft> {
  const cfg = CHANNEL_GUIDE[channel] ?? { lang: 'he' as Lang, guide: 'תוכן שיווקי קצר וברור.' };

  // 1) channel-specific draft
  const draftSystem =
    cfg.lang === 'he'
      ? `אתה קופירייטר מנוסה. כתוב תוכן שיווקי עבור ${channel}. ${cfg.guide} כתוב בעברית תקנית ואנושית. החזר אך ורק את התוכן, בלי הקדמות.`
      : `You are an expert copywriter. Write marketing content for ${channel}. ${cfg.guide} Return only the content, no preamble.`;
  let body = await claude(draftSystem, `כותרת: ${title}\nבריף: ${brief}`);

  // 2) Hebrew branch — humanize + proofread ("Hebrew Content by Helix")
  if (cfg.lang === 'he') {
    body = await claude(
      'אתה עורך עברית. שכתב את הטקסט כך שיישמע אנושי-ישראלי טבעי (לא כמו בינה מלאכותית), ותקן כל שגיאת כתיב או דקדוק. שמור על המשמעות, הטון והאורך. החזר אך ורק את הטקסט המתוקן.',
      body
    );
  }

  // 3) AI-detection score (gate signal)
  const scoreRaw = await claude(
    cfg.lang === 'he'
      ? 'דרג עד כמה הטקסט הבא נשמע אנושי (100) לעומת נכתב על ידי AI (0). החזר אך ורק מספר בין 0 ל-100.'
      : 'Rate how human (100) vs AI-written (0) the following text reads. Return only a number 0-100.',
    body,
    10
  );
  const aiScore = Math.max(0, Math.min(100, parseInt(scoreRaw.replace(/\D/g, ''), 10) || 0));

  return { body, language: cfg.lang, aiScore };
}

// A/B variants for one channel, organized as ANGLES × variations. Each of the 6
// persuasion angles yields up to 6 distinct variations of that same angle, so a
// full channel can produce up to 36 test variants. Cost-efficient: one generation
// call + one scoring call PER ANGLE (JSON-batched), not per variation.
export type Variant = ChannelDraft & {
  angle: string;
  angleIndex: number;
  variationIndex: number;
  index: number; // global 0-based index
};

const ANGLES: { he: string; en: string }[] = [
  { he: 'תועלת ישירה (מה הלקוח מרוויח)', en: 'Direct benefit (what the customer gains)' },
  { he: 'כאב/בעיה (מה כואב בלי הפתרון)', en: 'Pain/problem (what hurts without it)' },
  { he: 'הוכחה חברתית (מספרים/עדויות)', en: 'Social proof (numbers/testimonials)' },
  { he: 'דחיפות/הצעה (זמן מוגבל, מבצע)', en: 'Urgency/offer (limited time, deal)' },
  { he: 'סיפור/רגש (סיטואציה שהקהל מזדהה)', en: 'Story/emotion (a relatable situation)' },
  { he: 'שאלה/סקרנות (hook פותח)', en: 'Question/curiosity (opening hook)' },
];

function parseJsonArray(raw: string): unknown[] {
  try { const m = raw.match(/\[[\s\S]*\]/); return m ? (JSON.parse(m[0]) as unknown[]) : []; } catch { return []; }
}

// Generate `count` distinct variations for one angle, humanized in-prompt, then
// batch-score them. Returns the variation bodies + per-variation AI scores.
async function variationsForAngle(
  brief: string, title: string, channel: string, guide: string, lang: Lang, angle: string, count: number
): Promise<{ body: string; aiScore: number }[]> {
  const genSystem = lang === 'he'
    ? `אתה קופירייטר ישראלי מנוסה. כתוב ${count} וריאציות **שונות זו מזו** לתוכן ${channel} מהזווית: "${angle}". ${guide} שנֵה בין הווריאציות את ה-hook הפותח, האורך, ניסוח ה-CTA והמקצב — אבל שמור על אותה זווית. עברית אנושית-ישראלית טבעית (לא כמו AI). החזר JSON בלבד: array של ${count} מחרוזות.`
    : `You are an expert copywriter. Write ${count} **distinct** variations of ${channel} content from this angle: "${angle}". ${guide} Vary the opening hook, length, CTA phrasing and rhythm across variations, same angle. Return JSON only: an array of ${count} strings.`;
  const genRaw = await claude(genSystem, `כותרת: ${title}\nבריף: ${brief}`, 1500);
  let bodies = parseJsonArray(genRaw).map((x) => String(x)).filter(Boolean).slice(0, count);
  if (bodies.length === 0) bodies = [genRaw]; // fallback: model returned prose

  // Batch AI-humanness scores (one call → array of numbers).
  const scoreRaw = await claude(
    lang === 'he'
      ? `דרג כל טקסט 0-100 (100=אנושי, 0=AI). החזר JSON בלבד: array של ${bodies.length} מספרים, לפי הסדר.`
      : `Rate each text 0-100 (100=human). Return JSON only: an array of ${bodies.length} numbers, in order.`,
    bodies.map((b, i) => `[${i + 1}]\n${b}`).join('\n\n'), 120
  );
  const scores = parseJsonArray(scoreRaw).map((x) => Math.max(0, Math.min(100, parseInt(String(x).replace(/\D/g, ''), 10) || 0)));

  return bodies.map((body, i) => ({ body, aiScore: scores[i] ?? 0 }));
}

export async function generateChannelVariants(
  brief: string,
  title: string,
  channel: string,
  anglesCount = 6,
  variationsPerAngle = 6
): Promise<Variant[]> {
  const cfg = CHANNEL_GUIDE[channel] ?? { lang: 'he' as Lang, guide: 'תוכן שיווקי קצר וברור.' };
  const aCount = Math.max(1, Math.min(6, anglesCount));
  const vCount = Math.max(1, Math.min(6, variationsPerAngle));

  // Each angle handled in parallel; variations batched inside.
  const perAngle = await Promise.all(
    ANGLES.slice(0, aCount).map(async (angleDef, angleIndex) => {
      const angle = cfg.lang === 'he' ? angleDef.he : angleDef.en;
      const vs = await variationsForAngle(brief, title, channel, cfg.guide, cfg.lang, angle, vCount);
      return vs.map((v, variationIndex): Omit<Variant, 'index'> => ({
        body: v.body, language: cfg.lang, aiScore: v.aiScore, angle, angleIndex, variationIndex,
      }));
    })
  );

  return perAngle.flat().map((v, index) => ({ ...v, index }));
}
