// Scheduler archetype (collected from the OPS playbook — best-time-to-post). Picks a
// recommended posting window per channel from simple, explainable heuristics (IL
// audience). Deterministic, no model call. The cron/operator uses it to time the
// approved comment instead of posting the instant it's drafted.
export interface PostWindow {
  label: string; // human window, e.g. "ערב, 19:00–21:00"
  reason: string;
}

const WINDOWS: Record<string, PostWindow> = {
  לינקדאין: { label: 'בוקר של יום-חול, 08:00–10:00', reason: 'קהל B2B פעיל בתחילת יום העבודה' },
  linkedin: { label: 'בוקר של יום-חול, 08:00–10:00', reason: 'קהל B2B פעיל בתחילת יום העבודה' },
  פייסבוק: { label: 'ערב, 19:00–21:00', reason: 'שיא הגלישה הפרטית' },
  facebook: { label: 'ערב, 19:00–21:00', reason: 'שיא הגלישה הפרטית' },
  אינסטגרם: { label: 'ערב, 20:00–22:00', reason: 'שיא ה-engagement הוויזואלי' },
  instagram: { label: 'ערב, 20:00–22:00', reason: 'שיא ה-engagement הוויזואלי' },
};

export function bestPostWindow(channel: string): PostWindow {
  return WINDOWS[channel] ?? { label: 'שעות היום (10:00–16:00), לא בשבת/חג', reason: 'ברירת-מחדל בטוחה' };
}
