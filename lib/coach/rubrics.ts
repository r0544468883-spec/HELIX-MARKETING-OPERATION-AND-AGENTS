// Channel-aware rubrics for the coach engines. Business-agnostic: the same
// content/presence quality dimensions, weighted per channel. Extensible — add a
// channel by adding an entry here.

export type Dimension = { key: string; label: string; weight: number; hint: string };

// ── Content Coach: score a DRAFT before publishing, per channel ──────────────
export type ContentChannel =
  | 'email'
  | 'facebook_profile' | 'facebook_page' | 'facebook_group'
  | 'linkedin' | 'linkedin_company'
  | 'instagram';

export const CONTENT_CHANNELS: Record<ContentChannel, { label: string; note: string; dims: Dimension[] }> = {
  email: {
    label: 'מייל',
    note: 'מייל קר/שיווקי. הנושא וה-preview הם 80% מהפתיחה; גוף קצר עם CTA אחד ברור.',
    dims: [
      { key: 'subject', label: 'שורת נושא', weight: 3, hint: 'האם הנושא מסקרן/רלוונטי ומעודד פתיחה? לא clickbait, לא ספאמי.' },
      { key: 'preview', label: 'Preview / שורה ראשונה', weight: 1.5, hint: 'האם השורה הראשונה ממשיכה את הנושא ומושכת להמשיך?' },
      { key: 'hook', label: 'פתיח (Hook)', weight: 2, hint: 'האם הפתיחה תופסת ב-2 שניות ומדברת על הנמען ולא עלינו?' },
      { key: 'clarity', label: 'בהירות', weight: 2, hint: 'מסר אחד ברור; בלי ז׳רגון מיותר.' },
      { key: 'cta', label: 'CTA', weight: 2, hint: 'קריאה אחת לפעולה, ברורה וקלה לביצוע.' },
      { key: 'deliverability', label: 'Deliverability', weight: 1.5, hint: 'מילים/סימנים שמריחים ספאם, יחס תמונה/טקסט, אורך — סיכון להגעה ל-Promotions/Spam.' },
      { key: 'length_fit', label: 'אורך', weight: 1, hint: 'קצר מספיק לקריאה בנייד?' },
    ],
  },
  facebook_profile: {
    label: 'פוסט בפרופיל פייסבוק פרטי',
    note: 'פוסט אישי בפרופיל. סיפור/רגש עובד; hook בשורה הראשונה (לפני "עוד"); engagement-bait עדין ולגיטימי.',
    dims: [
      { key: 'hook', label: 'שורה ראשונה (Hook)', weight: 3, hint: 'האם השורה הראשונה עוצרת גלילה ומכריחה ללחוץ "עוד"?' },
      { key: 'story', label: 'סיפור/רגש', weight: 2, hint: 'האם יש נרטיב/רגש שקהל מזדהה איתו?' },
      { key: 'engagement', label: 'פוטנציאל תגובות', weight: 2, hint: 'שאלה/עמדה שמזמינה תגובות — בלי engagement-bait זול.' },
      { key: 'authenticity', label: 'אותנטיות', weight: 2, hint: 'נשמע אנושי-אמיתי, לא כמו פרסומת או בוט.' },
      { key: 'cta', label: 'CTA רך', weight: 1, hint: 'הזמנה עדינה (תגובה/שיתוף/פנייה) בלי למכור בכוח.' },
      { key: 'length_fit', label: 'אורך ומבנה', weight: 1, hint: 'פסקאות קצרות, רווח לנשימה, לא קיר טקסט.' },
    ],
  },
  facebook_group: {
    label: 'פוסט בקבוצת פייסבוק',
    note: 'קבוצות רגישות לספאם. חובה value-first, מודעות לחוקי-הקבוצה, וטון קהילתי — קידום ישיר נענש/נמחק.',
    dims: [
      { key: 'value_first', label: 'ערך-קודם', weight: 3, hint: 'האם הפוסט נותן ערך אמיתי לפני כל בקשה? לא פרסומת מוסווית.' },
      { key: 'rules_awareness', label: 'התאמה לקבוצה', weight: 2, hint: 'מכבד חוקי-קבוצה טיפוסיים (בלי לינקים אגרסיביים/מכירה ישירה)?' },
      { key: 'hook', label: 'פתיח', weight: 1.5, hint: 'פותח בעניין רלוונטי לקהילה, לא בעצמנו.' },
      { key: 'engagement', label: 'פוטנציאל דיון', weight: 2, hint: 'שאלה/דיון שהקהילה תרצה להשתתף בו.' },
      { key: 'soft_cta', label: 'CTA רך/עקיף', weight: 1.5, hint: 'הזמנה עקיפה (בפרטי/בתגובות) במקום לינק-מכירה גלוי.' },
      { key: 'authenticity', label: 'אותנטיות', weight: 1, hint: 'טון של חבר בקהילה, לא של מפרסם.' },
    ],
  },
  facebook_page: {
    label: 'פוסט בעמוד עסקי פייסבוק',
    note: 'עמוד עסקי ממותג. מותר קידום, אבל ערך-קודם עדיין מנצח. CTA ברור, מסר מותג עקבי, ויזואל.',
    dims: [
      { key: 'hook', label: 'שורה ראשונה (Hook)', weight: 2.5, hint: 'עוצר גלילה, רלוונטי לקהל היעד של העמוד.' },
      { key: 'brand_voice', label: 'קול-מותג', weight: 2, hint: 'עקבי לזהות המותג, לא גנרי.' },
      { key: 'value', label: 'ערך/הצעה', weight: 2, hint: 'תועלת/הצעה ברורה לצרכן, לא רק "אנחנו מעולים".' },
      { key: 'engagement', label: 'פוטנציאל תגובות', weight: 1.5, hint: 'מזמין reaction/תגובה/שיתוף.' },
      { key: 'cta', label: 'CTA', weight: 2, hint: 'קריאה לפעולה ברורה (קנייה/הרשמה/הודעה).' },
      { key: 'length_fit', label: 'אורך ומבנה', weight: 1, hint: 'קצר, קריא בנייד, ויזואל תומך.' },
    ],
  },
  linkedin: {
    label: 'פוסט לינקדאין (פרופיל)',
    note: 'לינקדאין מתגמל תובנה מקצועית + hook חזק. פורמט קריא (שורות קצרות). קרוסלה/סקר מגדילים reach.',
    dims: [
      { key: 'hook', label: 'Hook פותח', weight: 3, hint: 'האם 1-2 השורות הראשונות (לפני "...see more") עוצרות גלילה?' },
      { key: 'value', label: 'ערך/תובנה', weight: 2.5, hint: 'תובנה מקצועית אמיתית, לא סופרלטיבים.' },
      { key: 'engagement', label: 'פוטנציאל engagement', weight: 2, hint: 'שאלה/עמדה שמזמינה תגובה מקצועית.' },
      { key: 'format', label: 'פורמט/קריאות', weight: 1.5, hint: 'שורות קצרות, רווחים, אפשר קרוסלה/סקר.' },
      { key: 'authenticity', label: 'אותנטיות (לא-בוט)', weight: 2, hint: 'נשמע כמו אדם אמיתי, לא כמו AI/פרסומת.' },
      { key: 'cta', label: 'CTA', weight: 1, hint: 'הזמנה לתגובה/שיתוף/דעה.' },
    ],
  },
  linkedin_company: {
    label: 'פוסט בעמוד חברה בלינקדאין',
    note: 'עמוד חברה = מנהיגות-מחשבתית של המותג. טון מקצועי-מותגי, ערך לקהל, לא סתם הכרזות.',
    dims: [
      { key: 'hook', label: 'Hook פותח', weight: 2.5, hint: 'פתיח שמושך את הקהל המקצועי של החברה.' },
      { key: 'value', label: 'ערך/מנהיגות-מחשבתית', weight: 2.5, hint: 'תובנה/מחקר/עמדה שממצבת את המותג כאוטוריטה.' },
      { key: 'brand_voice', label: 'קול-מותג', weight: 2, hint: 'עקבי ומקצועי, לא יבש-תאגידי.' },
      { key: 'engagement', label: 'פוטנציאל engagement', weight: 1.5, hint: 'מזמין דיון מקצועי, לא רק לייקים של עובדים.' },
      { key: 'format', label: 'פורמט/קריאות', weight: 1.5, hint: 'שורות קצרות; מדיה/דוקומנט/סקר.' },
      { key: 'cta', label: 'CTA', weight: 1, hint: 'הזמנה לפעולה מקצועית (הורדה/הרשמה/דיון).' },
    ],
  },
  instagram: {
    label: 'פוסט/כיתוב אינסטגרם',
    note: 'ויזואל-first. hook בשורה הראשונה (לפני "...more"), כיתוב קצר-בינוני, 3-8 האשטגים רלוונטיים.',
    dims: [
      { key: 'hook', label: 'שורה ראשונה (Hook)', weight: 3, hint: 'עוצר גלילה לפני חיתוך ה-"...more".' },
      { key: 'visual_fit', label: 'התאמה לויזואל', weight: 2, hint: 'הכיתוב משלים את התמונה/וידאו, לא חוזר עליו.' },
      { key: 'engagement', label: 'פוטנציאל engagement', weight: 2, hint: 'שאלה/הנעה לשמירה/שיתוף/תגובה.' },
      { key: 'hashtags', label: 'האשטגים', weight: 1.5, hint: '3-8 האשטגים ממוקדים ורלוונטיים, לא ספאם.' },
      { key: 'cta', label: 'CTA', weight: 1.5, hint: 'קריאה לפעולה (שמור/שתף/לינק בביו/הודעה).' },
      { key: 'authenticity', label: 'אותנטיות', weight: 1, hint: 'טון אמיתי, לא פרסומת נוקשה.' },
    ],
  },
};

// ── Presence Score: audit a PROFILE/presence, per channel ────────────────────
export type PresenceChannel =
  | 'linkedin' | 'linkedin_company'
  | 'facebook_profile' | 'facebook_page'
  | 'instagram_profile' | 'instagram_business'
  | 'email_sender';

export const PRESENCE_CHANNELS: Record<PresenceChannel, { label: string; note: string; criteria: Dimension[] }> = {
  linkedin: {
    label: 'פרופיל לינקדאין',
    note: 'ציון חשיפה + מותג אישי כאוטוריטה. מבוסס על 10 הקריטריונים שמשפיעים על החיפוש והרושם.',
    criteria: [
      { key: 'url', label: 'איכות הקישור לפרופיל', weight: 1, hint: 'URL מותאם אישית (לא מספרים אקראיים).' },
      { key: 'photo', label: 'תמונת פרופיל', weight: 1.5, hint: 'מקצועית, פנים ברורות, רקע נקי.' },
      { key: 'cover', label: 'תמונת קאבר', weight: 1, hint: 'באנר ממותג שמעביר מסר, לא ברירת-מחדל.' },
      { key: 'headline', label: 'Headline', weight: 2, hint: 'ערך + מילות מפתח לחיפוש, לא רק "תפקיד ב-חברה".' },
      { key: 'about', label: 'About / אודות', weight: 2, hint: 'סיפור + ערך + מילות מפתח + CTA.' },
      { key: 'featured', label: 'Featured', weight: 1, hint: 'תוכן נבחר (פוסט/לינק/מדיה) שמוכיח ערך.' },
      { key: 'experience', label: 'Experience', weight: 1.5, hint: 'תיאורי-הישגים, לא רק כותרות תפקיד.' },
      { key: 'education', label: 'Education', weight: 0.75, hint: 'השכלה רלוונטית ומלאה.' },
      { key: 'skills', label: 'Skills', weight: 1, hint: 'סקילים רלוונטיים + endorsements.' },
      { key: 'recommendations', label: 'Recommendations', weight: 1.25, hint: 'המלצות אמיתיות שמחזקות אוטוריטה.' },
    ],
  },
  linkedin_company: {
    label: 'עמוד חברה בלינקדאין',
    note: 'נוכחות תאגידית שמושכת עוקבים, מועמדים ולקוחות, וממצבת אוטוריטה.',
    criteria: [
      { key: 'logo', label: 'לוגו', weight: 1.5, hint: 'לוגו חד ומקצועי בגודל תקין.' },
      { key: 'banner', label: 'באנר/קאבר', weight: 1.5, hint: 'באנר ממותג עם מסר/הצעת-ערך.' },
      { key: 'tagline', label: 'Tagline', weight: 2, hint: 'משפט אחד שמסביר מה החברה עושה + מילות מפתח.' },
      { key: 'about', label: 'About/אודות', weight: 2, hint: 'סיפור החברה + ערך + מילות מפתח לחיפוש.' },
      { key: 'specialties', label: 'Specialties', weight: 1, hint: 'תחומי-התמחות מוגדרים (SEO פנימי).' },
      { key: 'showcase', label: 'Showcase/Products', weight: 1, hint: 'עמודי-Showcase או מוצרים במידת הצורך.' },
      { key: 'completeness', label: 'שלמות פרטים', weight: 1.5, hint: 'אתר, גודל, תעשייה, מיקום, קישור עובדים.' },
      { key: 'activity', label: 'פעילות', weight: 1, hint: 'פרסום עקבי ומעורבות עובדים.' },
    ],
  },
  facebook_profile: {
    label: 'פרופיל פייסבוק פרטי',
    note: 'נוכחות אישית שמושכת עוקבים ופניות.',
    criteria: [
      { key: 'photo', label: 'תמונת פרופיל', weight: 2, hint: 'ברורה, מקצועית, מזוהה.' },
      { key: 'cover', label: 'תמונת קאבר', weight: 1.5, hint: 'ממותגת עם מסר/הצעה.' },
      { key: 'bio', label: 'ביו/Intro', weight: 2, hint: 'מי אתה + למי אתה עוזר + CTA.' },
      { key: 'pinned', label: 'פוסט נעוץ', weight: 1.5, hint: 'פוסט נעוץ שמציג ערך/הצעה/הוכחה.' },
      { key: 'featured_links', label: 'קישורים בולטים', weight: 1, hint: 'קישור לאתר/עסק/יצירת-קשר גלוי.' },
      { key: 'about', label: 'About/פרטים', weight: 1, hint: 'פרטי יצירת-קשר, קישורים, מקום עבודה.' },
      { key: 'activity', label: 'פעילות/עקביות', weight: 1, hint: 'פרסום עקבי ותגובתיות.' },
    ],
  },
  facebook_page: {
    label: 'עמוד עסקי בפייסבוק',
    note: 'עמוד עסקי שמושך פניות והמרות; מוניטין ותגובתיות חשובים.',
    criteria: [
      { key: 'photo', label: 'תמונת פרופיל/לוגו', weight: 1.5, hint: 'לוגו מקצועי מזוהה.' },
      { key: 'cover', label: 'תמונת קאבר', weight: 1.5, hint: 'ממותגת עם הצעת-ערך/מבצע.' },
      { key: 'about', label: 'About/תיאור', weight: 1.5, hint: 'מה העסק עושה + למי + מילות מפתח.' },
      { key: 'cta_button', label: 'כפתור CTA', weight: 2, hint: 'כפתור פעולה (הודעה/הזמנה/התקשרות/אתר).' },
      { key: 'category_info', label: 'קטגוריה + פרטים', weight: 1, hint: 'קטגוריה, שעות, כתובת, טלפון, אתר.' },
      { key: 'pinned', label: 'פוסט נעוץ', weight: 1, hint: 'פוסט נעוץ עם הצעה/הוכחה.' },
      { key: 'reviews', label: 'ביקורות/מוניטין', weight: 1.5, hint: 'דירוג וביקורות חיוביות, מענה לביקורות.' },
      { key: 'response_rate', label: 'זמן תגובה', weight: 1, hint: '"מגיב במהירות" — response rate גבוה.' },
    ],
  },
  instagram_profile: {
    label: 'פרופיל אינסטגרם אישי',
    note: 'נוכחות אישית ויזואלית; הביו והקישור הם שער-ההמרה.',
    criteria: [
      { key: 'photo', label: 'תמונת פרופיל', weight: 1.5, hint: 'ברורה ומזוהה.' },
      { key: 'handle_name', label: 'שם + Username', weight: 1.5, hint: 'שם עם מילות מפתח (השדה שנחפש), handle קליט.' },
      { key: 'bio', label: 'ביו', weight: 2.5, hint: 'מי אתה + ערך + CTA, בשורות קצרות/אימוג׳י.' },
      { key: 'link', label: 'קישור בביו', weight: 2, hint: 'קישור פעיל (link-in-bio/אתר).' },
      { key: 'highlights', label: 'Highlights', weight: 1.5, hint: 'סטוריז שמורים מקוטלגים (הצעה/המלצות/שאלות).' },
      { key: 'grid', label: 'עקביות הפיד', weight: 1, hint: 'פיד ויזואלי עקבי ומזמין.' },
    ],
  },
  instagram_business: {
    label: 'פרופיל עסקי באינסטגרם',
    note: 'חשבון עסקי/creator עם כלי-המרה (כפתורי קשר, קטגוריה, תובנות).',
    criteria: [
      { key: 'photo', label: 'תמונת פרופיל/לוגו', weight: 1.5, hint: 'לוגו מקצועי מזוהה.' },
      { key: 'name_keywords', label: 'שם + מילות מפתח', weight: 1.5, hint: 'שם עסק עם מילות מפתח (שדה מחיפוש).' },
      { key: 'bio', label: 'ביו + CTA', weight: 2.5, hint: 'הצעת-ערך ברורה + קריאה לפעולה.' },
      { key: 'category', label: 'קטגוריה עסקית', weight: 1, hint: 'קטגוריה מוגדרת ותווית עסקית.' },
      { key: 'contact_buttons', label: 'כפתורי יצירת-קשר', weight: 2, hint: 'הודעה/מייל/טלפון/הוראות-הגעה מוגדרים.' },
      { key: 'link', label: 'קישור/לינקים', weight: 1.5, hint: 'קישור פעיל (או מספר לינקים).' },
      { key: 'highlights', label: 'Highlights', weight: 1, hint: 'הצעה/עדויות/שאלות נפוצות מקוטלגים.' },
    ],
  },
  email_sender: {
    label: 'הגדרת שולח מייל (Deliverability)',
    note: 'המקבילה ל"פרופיל" בעולם המייל — מוניטין שולח שקובע אם המיילים בכלל מגיעים.',
    criteria: [
      { key: 'spf', label: 'SPF', weight: 2, hint: 'רשומת SPF תקינה לדומיין השולח.' },
      { key: 'dkim', label: 'DKIM', weight: 2, hint: 'חתימת DKIM מוגדרת ומאומתת.' },
      { key: 'dmarc', label: 'DMARC', weight: 2, hint: 'מדיניות DMARC (לפחות p=none עם דיווח).' },
      { key: 'warmup', label: 'Warmup', weight: 1.5, hint: 'חימום הדרגתי של הדומיין/תיבה החדשים.' },
      { key: 'sender_name', label: 'שם/כתובת שולח', weight: 1, hint: 'שם שולח אנושי ומזוהה, לא no-reply גנרי.' },
      { key: 'reputation', label: 'מוניטין/רשימות', weight: 1.5, hint: 'לא ב-blacklists; יחס bounce/complaint נמוך.' },
    ],
  },
};
