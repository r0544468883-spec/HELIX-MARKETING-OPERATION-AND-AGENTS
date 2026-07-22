// Campaign over the bot — parse a natural WhatsApp/Telegram/email message into
// the structured campaign inputs (name, brief, channels, client persona, budget),
// build it with the SAME runner as the UI, and return a Hebrew summary to reply.
import { claude } from '../engagement/ai';
import { runCampaign, type CampaignInput } from '../campaign-run';
import { CAMPAIGN_CHANNELS } from '../campaign-agent';

const CHANNEL_IDS = CAMPAIGN_CHANNELS.map((c) => c.id);

function parseJson<T>(raw: string, fallback: T): T {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? (JSON.parse(m[0]) as T) : fallback; } catch { return fallback; }
}

// Extract structured campaign inputs from a free-text request.
export async function parseCampaignRequest(text: string): Promise<CampaignInput | null> {
  const raw = await claude(
    `אתה מנתח בקשות לבניית קמפיין. חלץ מהטקסט JSON בלבד:
{"name": string, "goal": string, "brief": string, "channels": string[], "clientProfile": {"name": string, "audience": string, "voice": string, "product": string}, "budget": {"total": number, "currency": "ILS", "per_channel": {}}}
channels יכול להכיל רק מהערכים: ${CHANNEL_IDS.join(', ')} (מפה: פייסבוק=facebook, אינסטגרם=instagram, לינקדאין=linkedin, גוגל=google_ads, סאו/SEO=seo). אם חסר תקציב או אפיון — השאר ריק. בלי טקסט נוסף.`,
    text, 1000
  );
  const parsed = parseJson<CampaignInput | null>(raw, null);
  if (!parsed || !parsed.name || !parsed.brief) return null;
  parsed.channels = (parsed.channels ?? []).filter((c) => CHANNEL_IDS.includes(c as typeof CHANNEL_IDS[number]));
  if (parsed.channels.length === 0) parsed.channels = ['facebook', 'instagram'];
  parsed.source = 'bot';
  return parsed;
}

// Build the campaign and return a short Hebrew reply for the bot.
export async function campaignFromText(client: unknown, ws: string, text: string): Promise<string> {
  const input = await parseCampaignRequest(text);
  if (!input) {
    return 'לא הצלחתי להבין את בקשת הקמפיין. נסה לכתוב: "בנה קמפיין ל<מוצר>, קהל <קהל>, בערוצים פייסבוק/גוגל/לינקדאין, תקציב <סכום>₪".';
  }
  const res = await runCampaign(client, ws, input);
  if (res.error || !res.result) return 'שגיאה בבניית הקמפיין: ' + (res.error ?? 'unknown');

  const lines = res.result.map((r) => {
    const b = r.budget ? ` (₪${r.budget.toLocaleString('he-IL')})` : '';
    if (r.asset.kind === 'social') { const angles = new Set(r.asset.variants.map((v) => v.angleIndex)).size; return `• ${r.channel}${b}: ${r.asset.variants.length} וריאציות A/B (${angles} סגנונות)`; }
    if (r.asset.kind === 'search_ads') return `• ${r.channel}${b}: ${r.asset.rsa.headlines.length} כותרות + ${r.asset.rsa.descriptions.length} תיאורים`;
    return `• ${r.channel}${b}: תוכנית SEO — ${r.asset.plan.keywords.length} מילות מפתח + outline`;
  });
  return `✅ קמפיין "${input.name}" נבנה:\n${lines.join('\n')}\n\nהיכנס למערכת לאישור ופרסום.`;
}
