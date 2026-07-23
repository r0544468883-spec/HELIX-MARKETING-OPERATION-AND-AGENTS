// WhatsApp TEMPLATE CATALOG — one approved template per PROACTIVE HELIX OPS feature
// that goes out over WhatsApp. Templates are the compliant way to open a conversation
// outside the 24h window (Meta §business-initiated). Each entry is BOTH:
//   1. a Meta registration payload (used by /api/templates/sync to create them), and
//   2. a runtime mapping (name + language + how to build the ordered {{n}} params)
//      used by the notifier to send via sendWhatsAppTemplate().
// UTILITY = transactional operator alert (campaign/A-B/budget/lead/avatar/digest).
// MARKETING = promotional broadcast that HELIX OPS pushes to an audience.

export type TemplateCategory = 'UTILITY' | 'MARKETING';

export type TemplateDef = {
  /** WhatsApp template name (a–z0–9_ only, unique per WABA). */
  name: string;
  language: string; // 'he'
  category: TemplateCategory;
  /** Body with {{1}},{{2}}… placeholders, exactly as registered with Meta. */
  body: string;
  /** Human-readable list of what each {{n}} is, for the example block + docs. */
  params: string[];
  /** Optional dynamic URL button (e.g. link to the campaign / landing page). {{1}} = suffix. */
  urlButton?: { text: string; baseUrl: string }; // full url = baseUrl + {{1}}
  sampleParams: string[];
  sampleUrlSuffix?: string;
};

// Feature → template. `key` names the proactive OPS feature that emits it.
export const TEMPLATES: Record<string, TemplateDef> = {
  // ── Transactional operator alerts (UTILITY) ──────────────────────────────
  campaign_published: {
    name: 'ops_campaign_published',
    language: 'he',
    category: 'UTILITY',
    body: 'שלום {{1}} 👋 הקמפיין "{{2}}" פורסם בהצלחה ב-{{3}} ({{4}} וריאציות). נתחיל לאסוף נתונים ונעדכן אותך.',
    params: ['שם המפעיל', 'שם הקמפיין', 'ערוצים', 'מספר וריאציות'],
    sampleParams: ['רון', 'השקת קיץ', 'פייסבוק, אינסטגרם', '6'],
  },
  ab_winner: {
    name: 'ops_ab_winner',
    language: 'he',
    category: 'UTILITY',
    body: 'עדכון A/B בקמפיין "{{1}}" ({{2}}): נבחרה הגרסה המנצחת עם CTR {{3}}. הפנינו אליה את התקציב. {{4}}',
    params: ['שם הקמפיין', 'ערוץ', 'אחוז CTR', 'שורת פירוט או ריק'],
    sampleParams: ['השקת קיץ', 'פייסבוק', '3.4%', 'שאר הגרסאות הושהו.'],
  },
  budget_threshold: {
    name: 'ops_budget_threshold',
    language: 'he',
    category: 'UTILITY',
    body: '⚠️ התראת תקציב: הקמפיין "{{1}}" הגיע ל-{{2}} מהתקציב היומי ({{3}}₪). {{4}}',
    params: ['שם הקמפיין', 'אחוז ניצול', 'סכום שנוצל', 'המלצה/פעולה או ריק'],
    sampleParams: ['השקת קיץ', '85%', '340', 'שקול/י להעלות תקציב או להשהות.'],
  },
  weekly_digest: {
    name: 'ops_weekly_digest',
    language: 'he',
    category: 'UTILITY',
    body: '📊 סיכום שבועי — {{1}}: {{2}} חשיפות, {{3}} קליקים, {{4}} לידים חדשים. {{5}}',
    params: ['טווח תאריכים', 'חשיפות', 'קליקים', 'לידים', 'שורת תובנה או ריק'],
    sampleParams: ['13-19/07', '124,500', '3,180', '42', 'הערוץ המוביל: אינסטגרם.'],
  },
  lead_alert: {
    name: 'ops_lead_alert',
    language: 'he',
    category: 'UTILITY',
    body: '🎯 ליד חדש מדף הנחיתה "{{1}}": {{2}} ({{3}}). הקישו לצפייה ומעקב.',
    params: ['שם דף הנחיתה', 'שם הליד', 'טלפון/אימייל'],
    urlButton: { text: 'פתח ליד', baseUrl: '{{APP_URL}}/leads/' },
    sampleParams: ['השקת קיץ', 'דנה כהן', '050-1234567'],
    sampleUrlSuffix: 'ld_abc123',
  },
  engagement_alert: {
    name: 'ops_engagement_alert',
    language: 'he',
    category: 'UTILITY',
    body: '💬 פעילות חדשה ({{1}}): {{2}} על "{{3}}". {{4}}',
    params: ['ערוץ/פלטפורמה', 'סוג הפעולה (תגובה/הודעה/אזכור)', 'הפוסט/הנושא', 'תקציר או ריק'],
    sampleParams: ['אינסטגרם', 'תגובה חדשה', 'פוסט ההשקה', 'תגובה חיובית — שווה מענה.'],
  },
  avatar_ready: {
    name: 'ops_avatar_ready',
    language: 'he',
    category: 'UTILITY',
    body: '🎬 סרטון האווטאר לקמפיין "{{1}}" מוכן. {{2}} הקישו לצפייה והורדה.',
    params: ['שם הקמפיין', 'שורת פירוט או ריק'],
    urlButton: { text: 'צפה בסרטון', baseUrl: '{{APP_URL}}/campaigns/' },
    sampleParams: ['השקת קיץ', 'משך: 32 שניות.'],
    sampleUrlSuffix: 'cmp_abc123',
  },
  landing_published: {
    name: 'ops_landing_published',
    language: 'he',
    category: 'UTILITY',
    body: '🚀 דף הנחיתה "{{1}}" עלה לאוויר. הקישו לצפייה בדף החי.',
    params: ['שם דף הנחיתה'],
    urlButton: { text: 'פתח דף נחיתה', baseUrl: '{{APP_URL}}/lp/' },
    sampleParams: ['השקת קיץ'],
    sampleUrlSuffix: 'summer-abc1',
  },
  // ── Promotional broadcasts pushed to an audience (MARKETING) ─────────────
  campaign_broadcast: {
    name: 'ops_campaign_broadcast',
    language: 'he',
    category: 'MARKETING',
    body: 'שלום {{1}} 👋 {{2}} {{3}} רוצים לשמוע עוד? הקישו לפרטים.',
    params: ['שם הנמען', 'שורת ההצעה/המסר', 'שורת ערך/הטבה או ריק'],
    urlButton: { text: 'לפרטים המלאים', baseUrl: '{{APP_URL}}/lp/' },
    sampleParams: ['דנה', 'השקנו קולקציית קיץ חדשה 🌞', 'ולזמן מוגבל — 20% הנחה.'],
    sampleUrlSuffix: 'summer-abc1',
  },
  promo_reengage: {
    name: 'ops_promo_reengage',
    language: 'he',
    category: 'MARKETING',
    body: 'היי {{1}}, מזמן לא התראינו! חזרנו עם {{2}}. {{3}}',
    params: ['שם הנמען', 'חידוש/הטבה', 'שורת קופון או ריק'],
    sampleParams: ['דנה', 'הטבת חוזרים בלעדית', 'קוד BACK15 מחכה לך 🎁'],
  },
};

/** Build the Meta message_templates registration payload for one template. */
export function registrationPayload(def: TemplateDef, appUrl: string): Record<string, unknown> {
  const components: Record<string, unknown>[] = [
    { type: 'BODY', text: def.body, example: { body_text: [def.sampleParams] } },
  ];
  if (def.urlButton) {
    const base = def.urlButton.baseUrl.replace('{{APP_URL}}', appUrl.replace(/\/$/, ''));
    components.push({
      type: 'BUTTONS',
      buttons: [{ type: 'URL', text: def.urlButton.text, url: `${base}{{1}}`, example: [`${base}${def.sampleUrlSuffix ?? 'sample'}`] }],
    });
  }
  return { name: def.name, language: def.language, category: def.category, components };
}

export function allRegistrationPayloads(appUrl: string): Record<string, unknown>[] {
  return Object.values(TEMPLATES).map((d) => registrationPayload(d, appUrl));
}

/** Registration payloads for an arbitrary set of defs (built-in ∪ custom). */
export function registrationPayloadsFor(defs: TemplateDef[], appUrl: string): Record<string, unknown>[] {
  return defs.map((d) => registrationPayload(d, appUrl));
}
