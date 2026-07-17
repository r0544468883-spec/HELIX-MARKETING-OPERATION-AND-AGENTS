import GettingStarted from '@/components/GettingStarted';
import RequestBoard, { type Req } from '@/components/RequestBoard';
import DemoEffects from '@/components/DemoEffects';

export const dynamic = 'force-dynamic';

// Demo screen — mock data, no Supabase. Just to SEE the UI + effects.
const MOCK: Req[] = [
  { id: 'd1', title: 'באנר לקמפיין חג', brief: 'באנר צבעוני עם מבצע 20% לחג.', channels: ['וואטסאפ', 'פייסבוק'], due_date: '2026-08-01', priority: 'high', status: 'new' },
  { id: 'd2', title: 'פוסט השקת מוצר', brief: 'פוסט לינקדאין מקצועי על ההשקה.', channels: ['לינקדאין'], due_date: null, priority: 'normal', status: 'new' },
  { id: 'd3', title: 'ניוזלטר חודשי', brief: 'סיכום החודש ללקוחות.', channels: ['מייל'], due_date: '2026-07-25', priority: 'urgent', status: 'in_progress' },
  { id: 'd4', title: 'סטורי אינסטגרם', brief: '', channels: ['אינסטגרם'], due_date: null, priority: 'low', status: 'review' },
  { id: 'd5', title: 'הודעת וואטסאפ ללקוחות', brief: 'עדכון על שעות פעילות בחג.', channels: ['וואטסאפ', 'טלגרם'], due_date: '2026-07-20', priority: 'normal', status: 'approved' },
];

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="max-w-[1100px] mx-auto px-5 md:px-10 pt-12 pb-10">
      <div className="bg-surface border border-brand rounded-xl p-3 mb-6 text-[13px] text-ink-secondary">
        🔎 מצב תצוגה (Demo) — נתוני דמה, בלי Supabase. גררו כרטיסים, רחפו, ולחצו על כפתורי האפקטים.
      </div>

      <h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-tight mb-6">
        HELIX OPS — תצוגה
      </h1>

      <GettingStarted locale={locale} hasBrand hasChannel={false} hasRequest />

      <h2 className="font-bold text-[18px] mb-1">אפקטים</h2>
      <DemoEffects />

      <h2 className="font-bold text-[18px] mb-4">לוח הבקשות (drag-drop · hover · חיפוש)</h2>
      <RequestBoard initial={MOCK} locale={locale} />
    </div>
  );
}
