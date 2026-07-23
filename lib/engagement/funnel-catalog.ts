// STARTER FUNNEL CATALOG — ready-made comment→auto-reply→DM funnels for the most
// common Hebrew triggers, so an operator can install a working set in one click
// instead of authoring each funnel by hand. Each entry maps 1:1 onto a row in the
// `comment_funnels` table (see lib/engagement/types.ts `CommentFunnel`).
//
// Install via installStarterFunnels(admin, workspaceId) — idempotent by keyword,
// or from the bot ("התקן פאנלים") / the secret-gated route
// app/api/engagement/install-starters.
import type { createAdminClient } from '../supabase/admin';
import type { CommentFunnel } from './types';

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// A catalog entry is the subset of CommentFunnel an operator seeds; id/workspace_id
// are assigned on install, post_id stays null so the funnel applies to every post.
export type StarterFunnel = Pick<
  CommentFunnel,
  'channel' | 'keyword' | 'public_reply_text' | 'dm_message' | 'dm_flow' | 'tier' | 'active'
>;

// Default channel for seeded funnels. comment_funnels.channel stores the Hebrew
// label used across this repo ('פייסבוק' | 'אינסטגרם'); Private-Reply funnels work
// the same on both, and an operator can duplicate/retarget after install.
const DEFAULT_CHANNEL = 'פייסבוק';

// The catalog. All keywords are single words (matcher does whole-word matching on
// single-word keywords, substring on phrases). dm_message supports {{שם}}/{{name}}.
export const STARTER_FUNNELS: StarterFunnel[] = [
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'מחיר',
    public_reply_text: 'שלחנו לך את כל הפרטים בהודעה פרטית 📩',
    dm_message:
      'היי {{שם}} 🙂 ראיתי ששאלת על המחיר — אשמח לשלוח לך את המחירון המלא ולהתאים לך את החבילה הנכונה. על איזה שירות חשבת?',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'כמה',
    public_reply_text: 'שלחנו לך את הפרטים והמחיר בפרטי 📩',
    dm_message:
      'היי {{שם}}! שמחים שהתעניינת 🙌 שלחתי לך כאן את פירוט המחירים. יש כמה אפשרויות — רוצה שאתאים לך את המשתלמת ביותר?',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'מעוניין',
    public_reply_text: 'מעולה! שלחנו לך פרטים בפרטי 📩',
    dm_message:
      'איזה כיף {{שם}} 🎉 אשמח לקדם אותך — ספר/י לי בכמה מילים מה בדיוק אתם צריכים ואחזור אליך עם הצעה מותאמת.',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'רוצה',
    public_reply_text: 'קיבלת ממני הודעה בפרטי עם כל הפרטים 📩',
    dm_message:
      'היי {{שם}} 😊 שמחתי לראות שאתם רוצים להתקדם! מה השלב הבא שהכי חשוב לכם עכשיו — שנקבע שיחה קצרה?',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'לינק',
    public_reply_text: 'שלחנו לך את הלינק בהודעה פרטית 📩',
    dm_message:
      'הנה {{שם}}, שלחתי לך כאן את הלינק עם כל המידע. אם משהו לא ברור אחרי שתעיף/י מבט — אני כאן 👋',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'פרטים',
    public_reply_text: 'שלחנו לך את כל הפרטים בפרטי 📩',
    dm_message:
      'היי {{שם}} 🙂 ריכזתי לך כאן את כל הפרטים החשובים. יש עוד משהו ספציפי שתרצה/י לדעת?',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'מידע',
    public_reply_text: 'שלחנו לך עוד מידע בהודעה פרטית 📩',
    dm_message:
      'שמח שהתעניינת {{שם}}! שלחתי לך כאן מידע נוסף. רוצה שאתמקד במשהו מסוים או אשלח את התמונה המלאה?',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'זמין',
    public_reply_text: 'בדקנו זמינות ושלחנו לך פרטים בפרטי 📩',
    dm_message:
      'היי {{שם}} 🙂 יש לנו זמינות! ספר/י לי לאיזה תאריך או שעה חשבתם ואבדוק לכם מיד.',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
  {
    channel: DEFAULT_CHANNEL,
    keyword: 'פנוי',
    public_reply_text: 'שלחנו לך פרטי זמינות בהודעה פרטית 📩',
    dm_message:
      'היי {{שם}}! נשאר לנו מקום 🙌 מתי הכי נוח לכם? אחזיק לכם מקום ברגע שנסגור פרטים.',
    dm_flow: [],
    tier: 'compliant',
    active: true,
  },
];

// Seed the catalog into comment_funnels for one workspace. Idempotent: skips any
// keyword the workspace already has a funnel for (matched case-sensitively on the
// exact keyword string). Returns how many were installed vs. skipped.
export async function installStarterFunnels(
  admin: Admin,
  workspaceId: string
): Promise<{ installed: number; skipped: number; total: number }> {
  const total = STARTER_FUNNELS.length;

  // Existing keywords for this workspace → skip duplicates.
  const { data: existing } = await admin
    .from('comment_funnels')
    .select('keyword')
    .eq('workspace_id', workspaceId);
  const have = new Set((existing ?? []).map((r) => (r as { keyword: string }).keyword));

  const toInsert = STARTER_FUNNELS.filter((f) => !have.has(f.keyword)).map((f) => ({
    workspace_id: workspaceId,
    channel: f.channel,
    post_id: null,
    keyword: f.keyword,
    public_reply_text: f.public_reply_text,
    dm_message: f.dm_message,
    dm_flow: f.dm_flow,
    tier: f.tier,
    active: f.active,
  }));

  if (toInsert.length) {
    const { error } = await admin.from('comment_funnels').insert(toInsert);
    if (error) throw new Error(error.message);
  }

  return { installed: toInsert.length, skipped: total - toInsert.length, total };
}
