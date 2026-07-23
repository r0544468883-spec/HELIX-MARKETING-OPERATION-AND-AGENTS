// Unified bot command router — the single entry every channel (Telegram/WhatsApp/
// email) funnels into, so ALL functions are reachable from the bot. Resolves the
// chat→workspace link, detects intent, executes, returns a reply string.
import { createAdminClient } from '../supabase/admin';
import { campaignFromText } from './campaign-bot';
import { audienceCommand, budgetCommand, landingCommand, avatarCommand, insightsCommand, paidCommand, funnelsCommand, installFunnelsCommand, templatesCommand } from './ops-commands';

export type BotChannel = 'telegram' | 'whatsapp' | 'email';

const HELP = [
  'שלום 👋 אני עוזר HELIX OPS. אפשר לבקש ממני בשפה חופשית, למשל:',
  '• "בנה קמפיין ל<מוצר>, קהל <קהל>, ערוצים פייסבוק/גוגל/לינקדאין, תקציב <סכום>₪"',
  '• "צור 6 וריאציות לפוסט על <נושא> לפייסבוק" (A/B)',
  '• "הצע קהלים ל<מוצר/בריף>" — סגמנטציית קהלים',
  '• "אופטימיזציית תקציב" — שמור מנצחות, השהה חלשות',
  '• "בנה דף נחיתה ל<מוצר>" — דף נחיתה עם מילוי AI',
  '• "אווטאר: <תסריט>" — הפקת סרטון דובר',
  '• "ביצועים" / "תובנות" — סיכום חשיפות, קליקים ו-CTR',
  '• "פרסם ממומן תקציב <סכום>" / "השהה ממומן" — קמפיין Meta ממומן',
  '• "פאנלים" — רשימת התגובות האוטומטיות (comment→DM) הפעילות',
  '• "התקן פאנלים" — התקנת קטלוג מוכן של פאנלים לטריגרים נפוצים',
  '• "תבניות" — קטלוג תבניות ה-WhatsApp',
  'כל פונקציה במערכת נגישה גם מכאן.',
].join('\n');

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// Resolve the workspace this chat is linked to (null if not linked yet).
async function resolveWorkspace(admin: Admin, channel: BotChannel, identifier: string): Promise<string | null> {
  const { data } = await admin.from('bot_links').select('workspace_id').eq('channel', channel).eq('identifier', identifier).maybeSingle();
  return (data?.workspace_id as string) ?? null;
}

export async function handleBotMessage(input: { channel: BotChannel; identifier: string; text: string }): Promise<string> {
  const admin = createAdminClient();
  if (!admin) return 'הבוט לא מוגדר (חסר service key).';
  const text = input.text.trim();
  const ws = await resolveWorkspace(admin, input.channel, input.identifier);

  if (!ws) {
    return 'הצ׳אט הזה עדיין לא מקושר לסביבת עבודה. היכנס למערכת → הגדרות בוט → הוסף את המזהה: ' + input.identifier;
  }

  // Intent routing (extensible — every OPS feature gets a branch here). Ordered
  // most-specific → generic so keyword overlaps resolve to the right function.
  const t = text.toLowerCase();
  if (/^(עזרה|help|\?)/i.test(text)) return HELP;

  // Paid campaign publish / pause (checked before the generic "קמפיין" branch).
  if (/(השהה|עצור|pause).*(ממומן|paid|קמפיין)|(ממומן|paid).*(השהה|עצור|pause)/i.test(text)) {
    return paidCommand(admin, ws, text, 'pause');
  }
  if (/(פרסם|הפעל|publish|launch).*(ממומן|paid)|(ממומן|paid).*(פרסם|הפעל|publish|launch)/i.test(text)) {
    return paidCommand(admin, ws, text, 'publish');
  }

  // Comment funnels — install FIRST (its text also contains "פאנלים"/"funnels").
  if (/(התקן|הוסף|install|seed).*(פאנל|funnel)|(פאנל|funnel).*(התקן|install)/i.test(text)) {
    return installFunnelsCommand(admin, ws);
  }
  if (t.includes('פאנל') || t.includes('funnel') || t.includes('תגובות אוטומטיות')) {
    return funnelsCommand(admin, ws);
  }
  // WhatsApp template catalog.
  if (t.includes('תבנית') || t.includes('תבניות') || t.includes('template')) {
    return templatesCommand();
  }

  // Audience segmentation.
  if (t.includes('קהל') || t.includes('סגמנט') || t.includes('audience') || t.includes('segment')) {
    return audienceCommand(admin, ws, text);
  }
  // Budget optimizer.
  if (t.includes('תקציב') || t.includes('אופטימיז') || t.includes('budget') || t.includes('optimi')) {
    return budgetCommand(admin, ws);
  }
  // Landing-page build.
  if (t.includes('דף נחיתה') || t.includes('נחיתה') || t.includes('landing') || t.includes('lp')) {
    return landingCommand(admin, ws, text);
  }
  // Avatar / spokesperson video.
  if (t.includes('אווטאר') || t.includes('avatar') || t.includes('סרטון') || t.includes('וידאו')) {
    return avatarCommand(admin, ws, text);
  }
  // Insights / metrics query.
  if (t.includes('ביצועים') || t.includes('תובנות') || t.includes('סטטיסטיק') || t.includes('נתונים') || t.includes('insights') || t.includes('metrics') || t.includes('stats')) {
    return insightsCommand(admin, ws);
  }

  if (t.includes('קמפיין') || t.includes('campaign')) {
    return campaignFromText(admin, ws, text);
  }
  if (t.includes('וריאצ') || t.includes('variant') || t.includes('a/b')) {
    // Route wording that clearly asks for A/B variants through the campaign parser
    // (single-channel campaign) — reuses the same builder.
    return campaignFromText(admin, ws, 'בנה קמפיין: ' + text);
  }
  return HELP;
}
