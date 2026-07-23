// Operator commands for HELIX OPS features beyond campaign/variant building.
// Each function is a thin bridge: it pulls the workspace data the underlying lib
// function needs, calls the SAME code the UI/cron uses, and returns a Hebrew reply.
// Kept out of router.ts so the router stays a pure intent switch.
import type { createAdminClient } from '../supabase/admin';
import { suggestAudiences } from '../audience-agent';
import { optimizePaidAsset } from '../budget-optimizer';
import { createMetaCampaign } from '../distribution/paid';
import { resolveAvatarKey, submitAvatar } from '../avatar';
import { LANDING_TEMPLATES, templatesForVertical } from '../landing/templates';
import { fillLandingContent } from '../landing/generate';
import { installStarterFunnels } from '../engagement/funnel-catalog';
import { TEMPLATES } from '../templates/whatsapp-catalog';
import { mergedWhatsAppTemplates } from '../templates/custom';

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

// facebook/instagram are the only channels with a paid Meta pipeline.
const PAID_LABEL: Record<string, string> = { facebook: 'פייסבוק', instagram: 'אינסטגרם' };

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^\w֐-׿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'lp';
}

// #2 — Audience segmentation: propose distinct Meta segments from a free-text brief.
export async function audienceCommand(_admin: Admin, _ws: string, text: string): Promise<string> {
  const brief = text.replace(/^.*?(קהל|סגמנט|audience)\S*/i, '').trim() || text.trim();
  try {
    const audiences = await suggestAudiences(brief || 'קמפיין', 3);
    if (!audiences.length) return 'לא הצלחתי להציע קהלים. נסה/י לתאר את המוצר והלקוח בכמה מילים.';
    const lines = audiences.map((a, i) => `${i + 1}. ${a.name} (${a.targeting.countries?.join(', ')}, גילאי ${a.targeting.ageMin}-${a.targeting.ageMax})\n   זווית: ${a.angle}`);
    return ['🎯 קהלי יעד מוצעים:', ...lines, '\nכל קהל יהפוך ל-ad set נפרד עם המסר שלו.'].join('\n');
  } catch (e) {
    return 'שגיאה בהצעת קהלים: ' + (e instanceof Error ? e.message : 'לא ידועה');
  }
}

// #4 — Budget optimizer: over every launched paid asset, keep the winning ad and
// pause the losers so spend concentrates on what works. Mirrors the cron.
export async function budgetCommand(admin: Admin, ws: string): Promise<string> {
  const { data: assets } = await admin.from('campaign_assets').select('channel, paid_campaign').eq('workspace_id', ws).not('paid_campaign', 'is', null).limit(100);
  if (!assets?.length) return 'אין קמפיינים ממומנים פעילים לאופטימיזציה כרגע.';
  let paused = 0, kept = 0;
  const cache = new Map<string, Record<string, unknown>>();
  for (const a of assets) {
    const label = PAID_LABEL[a.channel as string];
    if (!label) continue;
    let config = cache.get(label);
    if (!config) {
      const { data: conn } = await admin.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', label).maybeSingle();
      config = (conn?.config ?? {}) as Record<string, unknown>;
      cache.set(label, config);
    }
    const r = await optimizePaidAsset(config, (a.paid_campaign ?? {}) as { adsets?: { name: string; adsetId: string; adIds: string[] }[] });
    paused += r.paused; kept += r.kept;
  }
  return `💰 אופטימיזציית תקציב הושלמה: ${kept} מודעות מנצחות נשמרו, ${paused} מודעות חלשות הושהו. התקציב מתרכז במה שעובד.`;
}

// #3 — Landing page build: pick a template (by vertical if named), AI-fill from the
// brief, and persist a draft landing page. Returns its slug.
export async function landingCommand(admin: Admin, ws: string, text: string): Promise<string> {
  const brief = text.trim();
  // Try to detect a vertical keyword; else use all templates.
  const verticals: Record<string, string> = { 'סאס': 'saas', 'saas': 'saas', 'מרפאה': 'clinic', 'קליניקה': 'clinic', 'נדלן': 'realestate', 'נדל"ן': 'realestate', 'מסעדה': 'restaurant', 'חנות': 'ecommerce', 'איקומרס': 'ecommerce', 'סוכנות': 'agency', 'סטארטאפ': 'startup' };
  const vKey = Object.keys(verticals).find((k) => text.includes(k));
  const pool = vKey ? templatesForVertical(verticals[vKey]) : LANDING_TEMPLATES;
  const tpl = pool[0];
  if (!tpl) return 'לא נמצאה תבנית מתאימה לדף נחיתה.';
  try {
    const sections = brief ? await fillLandingContent(tpl.sections, brief) : tpl.sections;
    const name = (brief.slice(0, 40) || tpl.name).trim();
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await admin.from('landing_pages').insert({
      workspace_id: ws, name, slug, template: tpl.key, vertical: tpl.vertical, ux_style: tpl.ux_style, sections, published: false,
    });
    if (error) return 'שגיאה ביצירת דף הנחיתה: ' + error.message;
    return `🚀 נוצר דף נחיתה (טיוטה) על בסיס התבנית "${tpl.name}". כתובת: /lp/${slug}\nהיכנס/י למערכת לעריכה ופרסום.`;
  } catch (e) {
    return 'שגיאה ביצירת דף הנחיתה: ' + (e instanceof Error ? e.message : 'לא ידועה');
  }
}

// #5 — Avatar generation: render a spokesperson video from a script (HeyGen/D-ID).
// Uses the workspace's BYOK key or HELIX's managed key.
export async function avatarCommand(admin: Admin, ws: string, text: string): Promise<string> {
  const script = text.replace(/^.*?(אווטאר|וידאו|סרטון|avatar|video)\S*/i, '').trim() || text.trim();
  if (!script) return 'מה הטקסט לסרטון? כתוב/כתבי "אווטאר: <תסריט>".';
  const { data: conn } = await admin.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', 'avatar').maybeSingle();
  const provider = 'heygen' as const;
  const { key, managed } = resolveAvatarKey((conn?.config ?? {}) as Record<string, string>, provider);
  if (!key) return 'הפקת האווטאר לא מוגדרת (חסר מפתח HeyGen). הוסף/י מפתח בהגדרות → אווטאר.';
  try {
    const externalId = await submitAvatar(provider, key, { script });
    await admin.from('avatar_jobs').insert({ workspace_id: ws, provider, external_id: externalId, status: 'processing', managed });
    if (managed) await admin.from('avatar_usage').insert({ workspace_id: ws, provider, units: 1 });
    return '🎬 הסרטון בהפקה — יהיה מוכן עוד כדקה-שתיים ותקבל/י התראה.';
  } catch (e) {
    return 'שגיאה בהפקת הסרטון: ' + (e instanceof Error ? e.message : 'לא ידועה');
  }
}

// #6 — Insights / metrics query: aggregate real A/B numbers for the workspace.
export async function insightsCommand(admin: Admin, ws: string): Promise<string> {
  const [{ data: assets }, { data: variants }] = await Promise.all([
    admin.from('campaign_assets').select('id, channel').eq('workspace_id', ws),
    admin.from('content_variants').select('campaign_asset_id, impressions, views, clicks').eq('workspace_id', ws),
  ]);
  const assetCh = new Map((assets ?? []).map((a) => [a.id as string, a.channel as string]));
  let impressions = 0, views = 0, clicks = 0;
  const perCh = new Map<string, number>();
  for (const v of variants ?? []) {
    impressions += (v.impressions as number) ?? 0;
    views += (v.views as number) ?? 0;
    clicks += (v.clicks as number) ?? 0;
    const ch = assetCh.get(v.campaign_asset_id as string) ?? 'אחר';
    perCh.set(ch, (perCh.get(ch) ?? 0) + ((v.impressions as number) ?? 0));
  }
  if (!impressions && !clicks) return '📊 אין עדיין נתוני ביצועים. פרסמו קמפיין וההתראות יתחילו לזרום.';
  const ctr = impressions ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
  const top = [...perCh.entries()].sort((a, b) => b[1] - a[1])[0];
  return [
    '📊 ביצועים מצטברים:',
    `• חשיפות: ${impressions.toLocaleString('he-IL')}`,
    `• צפיות: ${views.toLocaleString('he-IL')}`,
    `• קליקים: ${clicks.toLocaleString('he-IL')} (CTR ${ctr}%)`,
    top ? `• ערוץ מוביל: ${top[0]}` : '',
  ].filter(Boolean).join('\n');
}

// #7 — Comment funnels: list the workspace's active comment→DM funnels so the
// operator sees which trigger words are wired and what each replies publicly.
export async function funnelsCommand(admin: Admin, ws: string): Promise<string> {
  const { data: funnels } = await admin
    .from('comment_funnels')
    .select('keyword, public_reply_text, active, channel')
    .eq('workspace_id', ws)
    .eq('active', true)
    .order('keyword', { ascending: true })
    .limit(50);
  if (!funnels?.length) {
    return 'אין עדיין תגובות אוטומטיות (פאנלים) פעילות. כתוב/כתבי "התקן פאנלים" כדי להתקין קטלוג מוכן של טריגרים נפוצים.';
  }
  const lines = funnels.map((f) => `• "${f.keyword as string}" → ${f.public_reply_text as string}`);
  return ['💬 תגובות אוטומטיות פעילות (טריגר → תגובה ציבורית):', ...lines, '\nלהוספת קטלוג מוכן: "התקן פאנלים".'].join('\n');
}

// #7b — Install the ready-made starter funnel catalog into this workspace.
export async function installFunnelsCommand(admin: Admin, ws: string): Promise<string> {
  try {
    const { installed, skipped, total } = await installStarterFunnels(admin, ws);
    if (installed === 0) {
      return `כל ${total} הפאנלים מהקטלוג כבר מותקנים אצלך — לא נוסף כלום. כתוב/כתבי "פאנלים" לרשימה.`;
    }
    return `✅ הותקנו ${installed} פאנלים מוכנים${skipped ? ` (${skipped} כבר היו קיימים)` : ''}. כתוב/כתבי "פאנלים" לרשימה המלאה.`;
  } catch (e) {
    return 'שגיאה בהתקנת הפאנלים: ' + (e instanceof Error ? e.message : 'לא ידועה');
  }
}

// #8 — Templates: list the WhatsApp template catalog (name + category) so the
// operator can reach the templates from the bot, not only from the system UI.
// Includes the workspace's custom (uploaded) templates, marked with "*".
export async function templatesCommand(ws?: string): Promise<string> {
  const merged = ws ? await mergedWhatsAppTemplates(ws) : { ...TEMPLATES };
  const entries = Object.entries(merged);
  if (!entries.length) return 'אין תבניות WhatsApp מוגדרות.';
  const label: Record<string, string> = { UTILITY: 'תפעולי', MARKETING: 'שיווקי' };
  const lines = entries.map(([key, t]) => {
    // A key is custom if it isn't a built-in, or its def was overridden (ref differs).
    const isCustom = merged[key] !== TEMPLATES[key];
    return `${isCustom ? '*' : '•'} ${t.name} [${label[t.category] ?? t.category}] — ${t.body}`;
  });
  return ['📋 קטלוג תבניות WhatsApp (* = מותאם אישית):', ...lines].join('\n');
}

// #4b — Paid campaign publish / pause from the bot.
export async function paidCommand(admin: Admin, ws: string, text: string, action: 'publish' | 'pause'): Promise<string> {
  if (action === 'pause') {
    // Pause = run the budget loop, which pauses underperforming ads.
    return budgetCommand(admin, ws);
  }
  // Publish: launch the most recent Meta-eligible asset as a PAUSED campaign hierarchy.
  const { data: asset } = await admin
    .from('campaign_assets')
    .select('id, channel, campaign_id')
    .eq('workspace_id', ws)
    .in('channel', ['facebook', 'instagram'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!asset) return 'לא נמצא קמפיין פייסבוק/אינסטגרם לפרסום ממומן. בנה/י קודם קמפיין.';
  const label = PAID_LABEL[asset.channel as string];
  const { data: variants } = await admin.from('content_variants').select('id, body, video_url').eq('campaign_asset_id', asset.id as string);
  if (!variants?.length) return 'אין וריאציות תוכן לקמפיין הזה.';
  const { data: conn } = await admin.from('channel_connections').select('config').eq('workspace_id', ws).eq('channel', label).maybeSingle();
  const budget = parseInt((text.match(/(\d[\d,]{1,7})/)?.[1] ?? '').replace(/,/g, ''), 10) || 50;
  const res = await createMetaCampaign((conn?.config ?? {}) as Record<string, unknown>, {
    name: `HELIX ${new Date().toISOString().slice(0, 10)}`,
    dailyBudget: budget,
    creatives: variants.map((v) => ({ message: v.body as string, picture: (v.video_url as string) || undefined })),
  });
  if (!res.ok) return 'שגיאה בפרסום הממומן: ' + res.error;
  await admin.from('campaign_assets').update({ paid_campaign: { meta_campaign_id: res.campaignId, adsets: res.adsets } }).eq('id', asset.id as string);
  const totalAds = (res.adsets ?? []).reduce((s, a) => s + a.adIds.length, 0);
  return `📣 קמפיין ממומן נוצר (מושהה לאישור): ${res.adsets?.length ?? 0} קהלים, ${totalAds} מודעות, תקציב ₪${budget}/יום. הפעל/י ב-Ads Manager אחרי בדיקה.`;
}
