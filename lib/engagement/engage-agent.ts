// Engagement copywriter — generates human-sounding comments and DM replies
// in the brand voice. Hebrew branch runs a humanize+proofread pass (baldiga-style).
import { claude } from './ai';

type Lang = 'he' | 'en';

// Detect Hebrew by script presence.
export function detectLang(text: string): Lang {
  return /[֐-׿]/.test(text) ? 'he' : 'en';
}

async function humanizeHe(text: string): Promise<string> {
  return claude(
    'אתה עורך עברית. שכתב כך שיישמע אנושי-ישראלי טבעי (לא כמו בינה מלאכותית) ותקן שגיאות כתיב. שמור על המשמעות, הטון והאורך. החזר אך ורק את הטקסט.',
    text,
    300
  );
}

// A contextual, human comment on someone else's post (feed/group engagement).
export async function generateComment(
  postText: string,
  brandVoice: string,
  lang: Lang = detectLang(postText)
): Promise<string> {
  const system =
    lang === 'he'
      ? `כתוב תגובה קצרה, אנושית ואותנטית לפוסט. ${brandVoice} משפט-שניים, בלי קידום בוטה, כמו אדם אמיתי. החזר רק את התגובה.`
      : `Write a short, human, authentic comment on the post. ${brandVoice} One or two sentences, no hard selling. Return only the comment.`;
  let body = await claude(system, postText, 200);
  if (lang === 'he') body = await humanizeHe(body);
  return body;
}

// A DM reply in an open conversation (auto-reply / funnel follow-up).
export async function generateDmReply(
  incoming: string,
  context: string,
  lang: Lang = detectLang(incoming)
): Promise<string> {
  const system =
    lang === 'he'
      ? `אתה נציג של העסק בשיחה פרטית. ${context} ענה קצר, חם ואנושי, עם שאלה אחת שמקדמת. החזר רק את התשובה.`
      : `You are the business rep in a private chat. ${context} Reply short, warm, human, with one advancing question. Return only the reply.`;
  let body = await claude(system, incoming, 300);
  if (lang === 'he') body = await humanizeHe(body);
  return body;
}

export type Intent = 'lead' | 'question' | 'spam' | 'other';

// Classify an inbound DM to route it (lead / question / spam / other).
export async function classifyIntent(message: string): Promise<Intent> {
  const raw = await claude(
    'Classify the message intent. Return ONLY one word: lead, question, spam, or other.',
    message,
    5
  );
  const w = raw.toLowerCase().trim();
  if (w.startsWith('lead')) return 'lead';
  if (w.startsWith('question')) return 'question';
  if (w.startsWith('spam')) return 'spam';
  return 'other';
}
