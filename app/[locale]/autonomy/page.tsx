import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AutonomySwitch from '@/components/AutonomySwitch';
import type { AutonomyMode } from '@/lib/autonomy/types';

export const dynamic = 'force-dynamic';

const FEATURES: { key: string; label: string; risky: boolean }[] = [
  { key: 'ops.engagement', label: '💬 תגובות/הודעות אוטומטיות', risky: true },
  { key: 'ops.ads', label: '💰 ניהול תקציב מודעות', risky: true },
  { key: 'ops.campaign_publish', label: '🚀 פרסום קמפיינים', risky: true },
  { key: 'ops.radar_outreach', label: '🎯 פנייה ללידים מהרדאר', risky: true },
  { key: 'ops.landing_publish', label: '🖥️ פרסום דפי נחיתה', risky: false },
];

export default async function AutonomyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const settings: Record<string, { mode: AutonomyMode; risk_ack: boolean }> = {};
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  const ws = mem?.workspace_id as string | undefined;
  if (ws) {
    const { data: rows } = await supabase.from('autonomy_settings').select('feature_key, mode, risk_ack').eq('workspace_id', ws);
    for (const r of (rows ?? []) as { feature_key: string; mode: AutonomyMode; risk_ack: boolean }[]) settings[r.feature_key] = { mode: r.mode, risk_ack: r.risk_ack };
  }

  return (
    <main dir="rtl" style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(20px,4vw,48px)' }}>
      <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, margin: '0 0 6px' }}>⚙️ מתג אוטונומיה</h1>
      <p style={{ color: 'var(--ink-2, #6b7280)', fontSize: 14, margin: '0 0 20px' }}>כמה חופש לתת ל-OPS לפעול לבד. ברירת מחדל בטוחה: המלצה בלבד. פעולות שמוציאות כסף/מפרסמות דורשות אישור מפורש.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
        {FEATURES.map((f) => (
          <AutonomySwitch key={f.key} featureKey={f.key} label={f.label} risky={f.risky}
            initialMode={settings[f.key]?.mode ?? 'advisor'} initialRiskAck={settings[f.key]?.risk_ack ?? false} />
        ))}
      </div>
    </main>
  );
}
