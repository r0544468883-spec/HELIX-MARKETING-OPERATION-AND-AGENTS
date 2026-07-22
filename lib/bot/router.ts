// Unified bot command router — the single entry every channel (Telegram/WhatsApp/
// email) funnels into, so ALL functions are reachable from the bot. Resolves the
// chat→workspace link, detects intent, executes, returns a reply string.
import { createAdminClient } from '../supabase/admin';
import { campaignFromText } from './campaign-bot';

export type BotChannel = 'telegram' | 'whatsapp' | 'email';

const HELP = [
  'שלום 👋 אני עוזר HELIX OPS. אפשר לבקש ממני, למשל:',
  '• "בנה קמפיין ל<מוצר>, קהל <קהל>, ערוצים פייסבוק/גוגל/לינקדאין, תקציב <סכום>₪"',
  '• "צור 6 וריאציות לפוסט על <נושא> לפייסבוק" (A/B)',
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

  // Intent routing (extensible — every function gets a branch here).
  const t = text.toLowerCase();
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
