import type { LandingTemplate, Section, UxStyle } from './types';
import { LEAD_FORM } from './types';

// Reusable block builders (placeholder content — edited or AI-filled per campaign).
const hero = (headline: string, sub: string, cta = 'התחילו עכשיו'): Section => ({ type: 'hero', headline, sub, cta_label: cta });
const benefits = (title: string, items: [string, string][]): Section => ({ type: 'benefits', title, items: items.map(([t, d]) => ({ title: t, desc: d })) });
const video = (title = 'צפו בסרטון'): Section => ({ type: 'video', title, video_url: '' });
const proof = (title = 'לקוחות מספרים'): Section => ({ type: 'proof', title, testimonials: [{ quote: 'שירות מעולה, ממליץ בחום.', name: 'לקוח מרוצה' }, { quote: 'תוצאות שלא ציפיתי להן.', name: 'לקוחה מרוצה' }] });
const faq = (items: [string, string][]): Section => ({ type: 'faq', title: 'שאלות נפוצות', items: items.map(([q, a]) => ({ q, a })) });
const cta = (headline: string, label = 'לפרטים'): Section => ({ type: 'cta', headline, cta_label: label });

function tpl(key: string, vertical: string, name: string, ux_style: UxStyle, sections: Section[]): LandingTemplate {
  return { key, vertical, name, ux_style, sections: [...sections, LEAD_FORM, cta('מוכנים להתחיל?', 'צרו קשר')] };
}

// 15+ templates, tailored per industry/market. Onboarding shows the ones for the
// chosen vertical; the user picks one and fills content (or lets the AI fill).
export const LANDING_TEMPLATES: LandingTemplate[] = [
  // E-commerce
  tpl('ecom-launch', 'ecommerce', 'השקת מוצר', 'bold', [hero('המוצר החדש שכולם מדברים עליו', 'הזמינו עכשיו במחיר השקה'), benefits('למה דווקא אנחנו', [['משלוח מהיר', 'עד הבית תוך 48 שעות'], ['החזר כספי', '30 יום התנסות'], ['איכות', 'חומרים מובחרים']]), video(), proof()]),
  tpl('ecom-sale', 'ecommerce', 'מבצע/סייל', 'bold', [hero('סוף עונה — עד 50% הנחה', 'המלאי אוזל, אל תפספסו'), benefits('ההטבות', [['קופון', 'קוד SALE50'], ['מתנה', 'לרכישה מעל ₪200'], ['ללא ריבית', 'עד 12 תשלומים']]), proof()]),
  tpl('ecom-signup', 'ecommerce', 'הרשמה להנחה', 'minimal', [hero('קבלו 15% הנחה על ההזמנה הראשונה', 'הצטרפו לרשימת התפוצה'), benefits('חברי המועדון מקבלים', [['הטבות', 'בלעדיות'], ['גישה מוקדמת', 'לקולקציות חדשות']])]),
  // SaaS
  tpl('saas-trial', 'saas', 'ניסיון חינם', 'minimal', [hero('נסו חינם 14 יום', 'בלי כרטיס אשראי, בלי התחייבות'), benefits('מה תקבלו', [['הקמה מהירה', 'תוך דקות'], ['תמיכה', '24/7 בעברית'], ['אינטגרציות', 'לכל הכלים שלכם']]), video(), proof()]),
  tpl('saas-demo', 'saas', 'קביעת דמו', 'dark', [hero('ראו את המערכת בפעולה', 'קבעו הדגמה אישית של 20 דקות'), benefits('בדמו נראה לכם', [['את הפתרון', 'מותאם לצרכים שלכם'], ['ROI', 'חישוב חיסכון'], ['מקרי לקוח', 'בתחום שלכם']])]),
  tpl('saas-waitlist', 'saas', 'רשימת המתנה', 'editorial', [hero('משהו חדש בדרך', 'הצטרפו לרשימת ההמתנה וקבלו גישה מוקדמת'), benefits('חברי הרשימה', [['ראשונים', 'לקבל גישה'], ['מחיר מוקדם', 'הנחת early-bird']])]),
  // Clinic / health
  tpl('clinic-appt', 'clinic', 'קביעת תור', 'luxury', [hero('הטיפול שמגיע לכם', 'קבעו תור עוד היום'), benefits('הקליניקה שלנו', [['צוות מומחה', 'שנות ניסיון'], ['ציוד מתקדם', 'טכנולוגיה חדשנית'], ['יחס אישי', 'ליווי מלא']]), proof(), faq([['כמה זמן טיפול?', 'תלוי בסוג — נעדכן בתיאום.'], ['יש חניה?', 'כן, חניה חינם ללקוחות.']])]),
  tpl('clinic-magnet', 'clinic', 'מדריך בריאות (Lead Magnet)', 'minimal', [hero('המדריך החינמי לבריאות טובה יותר', 'הורידו עכשיו — 10 טיפים מקצועיים'), benefits('במדריך', [['טיפים', 'מעשיים'], ['מחקר', 'מבוסס']])]),
  // Real estate
  tpl('realestate-project', 'realestate', 'הרשמה לפרויקט', 'luxury', [hero('פרויקט מגורים חדש במיקום מנצח', 'הצטרפו לרשימת המתעניינים'), benefits('הפרויקט', [['מיקום', 'לב העיר'], ['מפרט', 'עשיר וגמיש'], ['תנאי תשלום', 'נוחים']]), video(), proof()]),
  tpl('realestate-valuation', 'realestate', 'הערכת שווי', 'minimal', [hero('כמה שווה הנכס שלכם?', 'קבלו הערכת שווי חינם תוך 24 שעות'), benefits('למה איתנו', [['היכרות', 'עם השוק המקומי'], ['מכירה מהירה', 'רשת קונים']])]),
  // Restaurant / local
  tpl('restaurant-reserve', 'restaurant', 'הזמנת מקום', 'editorial', [hero('חוויה קולינרית בלתי נשכחת', 'הזמינו שולחן עכשיו'), benefits('אצלנו', [['תפריט', 'עונתי וטרי'], ['אווירה', 'מושלמת לכל אירוע'], ['שף', 'עטור פרסים']]), proof()]),
  tpl('local-coupon', 'restaurant', 'קופון/הטבה', 'bold', [hero('קופון בלעדי ללקוחות חדשים', 'הציגו והנה — 20% הנחה'), benefits('העסק שלנו', [['שירות', 'מהיר ואדיב'], ['מקום', 'נגיש ומרכזי']])]),
  // Agency / B2B
  tpl('agency-consult', 'agency', 'ייעוץ חינם', 'dark', [hero('בואו נצמיח את העסק שלכם', 'קבעו שיחת ייעוץ חינם — 30 דקות'), benefits('מה נעשה יחד', [['אבחון', 'של המצב הנוכחי'], ['אסטרטגיה', 'מותאמת'], ['תוכנית פעולה', 'ברורה']]), proof()]),
  tpl('b2b-webinar', 'b2b', 'וובינר/הרשמה', 'editorial', [hero('וובינר חינם: איך להכפיל תוצאות', 'הצטרפו — מספר המקומות מוגבל'), benefits('בוובינר תלמדו', [['שיטות', 'מוכחות'], ['כלים', 'ליישום מיידי'], ['Q&A', 'חי עם מומחה']])]),
  tpl('b2b-guide', 'b2b', 'הורדת מדריך', 'minimal', [hero('המדריך המלא ל-2026', 'הורידו חינם — 25 עמודים של ערך'), benefits('במדריך', [['נתונים', 'עדכניים'], ['תבניות', 'מוכנות לשימוש']])]),
  // Startup
  tpl('startup-access', 'startup', 'Early Access', 'dark', [hero('העתיד מתחיל כאן', 'הירשמו ל-Early Access'), benefits('החברים הראשונים', [['גישה', 'מוקדמת'], ['השפעה', 'על המוצר'], ['הטבות', 'מייסדים']]), video()]),
];

export function templatesForVertical(vertical: string): LandingTemplate[] {
  const inV = LANDING_TEMPLATES.filter((t) => t.vertical === vertical);
  return inV.length ? inV : LANDING_TEMPLATES;
}
export function templateByKey(key: string): LandingTemplate | undefined {
  return LANDING_TEMPLATES.find((t) => t.key === key);
}
