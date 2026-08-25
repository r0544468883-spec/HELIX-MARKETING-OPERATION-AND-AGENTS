// Creative-fatigue detection — the code embodiment of the ops-creative-fatigue-scanner
// skill (HELIX Agency Skill Pack, adapted from Outloop). PURE math (no I/O), same as
// scoring.ts, so it is trivially testable and runs anywhere. The engine already stores a
// time-series of snapshots per creative in creative_metrics (one row per as_of) but the
// scorer only ever reads the LATEST. Fatigue is a trend, not a snapshot — this reads the
// series and asks "is this creative decaying?".
//
// DISCIPLINE (mirrors the skill exactly — detection only):
//   * A creative is flagged ONLY on 2+ combined signals, never on a single noisy metric.
//   * Sparse data → 'insufficient_data', NEVER a forced verdict.
//   * This module NEVER pauses, edits, or suggests replacement creative. It returns a
//     ranked finding for a human (or the Budget Critic) to act on behind the autonomy gate.
//
// LIMITATION (stated honestly): Meta/TikTok "frequency" is not persisted in
// creative_metrics, so the canonical "frequency up + CTR down" pairing is approximated by
// "CTR down" + "cost-per-result up" + "ROAS down" computed from the fields we DO store
// (spend/impressions/clicks/conversions/revenue). If a connector later persists frequency,
// add it as a first-class signal here.

export type FatigueSnapshot = {
  asOf: string; // ISO timestamp
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export type FatigueSignal = 'ctr_down' | 'cost_per_result_up' | 'roas_down';

export type FatigueSeverity = 'high' | 'medium' | 'low';

export type FatigueVerdict = {
  status: 'fatigued' | 'healthy' | 'insufficient_data';
  signals: FatigueSignal[];
  severity: FatigueSeverity | null; // null unless status === 'fatigued'
  drift: number; // max relative degradation (0..1+) driving severity
  daysLive: number | null;
  note: string; // one-line "why this matters" (Hebrew, for the RTL report)
};

export type FatigueOptions = {
  /** Relative degradation (per signal) that counts as a fatigue signal. Default 0.15 = 15%. */
  threshold?: number;
  /** Min total impressions across the window before we'll judge at all. Default 1000. */
  minImpressions?: number;
  /** Min conversions before cost/ROAS signals are trusted (a CPA off 2 conversions is noise). Default 10. */
  minConversions?: number;
};

const DEFAULTS: Required<FatigueOptions> = { threshold: 0.15, minImpressions: 1000, minConversions: 10 };

/**
 * Judge one creative's snapshot series for fatigue. Snapshots may arrive in any order;
 * we sort by as_of, split into an early half and a recent half, and compare the mean of
 * each rate metric between the halves. Ratios (CTR, cost-per-result, ROAS) are robust
 * whether the connector reports per-period or cumulative totals.
 */
export function detectFatigue(snapshots: FatigueSnapshot[], opts: FatigueOptions = {}): FatigueVerdict {
  const o = { ...DEFAULTS, ...opts };
  const snaps = [...snapshots].sort((a, b) => a.asOf.localeCompare(b.asOf));

  // Need at least two readings to see a trend, and enough reach to trust it.
  const totalImpr = snaps.reduce((a, s) => a + (s.impressions || 0), 0);
  if (snaps.length < 2 || totalImpr < o.minImpressions) {
    return { status: 'insufficient_data', signals: [], severity: null, drift: 0, daysLive: daysLive(snaps), note: 'לא מספיק דאטה לשיפוט עייפות עדיין' };
  }

  const mid = Math.floor(snaps.length / 2);
  const early = snaps.slice(0, mid || 1);
  const recent = snaps.slice(mid || 1);
  const totalConv = snaps.reduce((a, s) => a + (s.conversions || 0), 0);

  const signals: FatigueSignal[] = [];
  let maxDrift = 0;

  // Signal 1: CTR falling (clicks/impressions). Impression-gated only — always trustable.
  const ctrEarly = meanRatio(early, (s) => (s.impressions > 0 ? s.clicks / s.impressions : null));
  const ctrRecent = meanRatio(recent, (s) => (s.impressions > 0 ? s.clicks / s.impressions : null));
  if (ctrEarly !== null && ctrRecent !== null && ctrEarly > 0) {
    const drop = (ctrEarly - ctrRecent) / ctrEarly; // positive = worse
    if (drop >= o.threshold) { signals.push('ctr_down'); maxDrift = Math.max(maxDrift, drop); }
  }

  // Signals 2 & 3 need conversion volume — a cost/ROAS trend off a handful of conversions
  // is noise, so they are conversion-gated (sparse → simply not raised, never forced).
  if (totalConv >= o.minConversions) {
    // Signal 2: cost-per-result rising (spend/conversions).
    const cprEarly = meanRatio(early, (s) => (s.conversions > 0 ? s.spend / s.conversions : null));
    const cprRecent = meanRatio(recent, (s) => (s.conversions > 0 ? s.spend / s.conversions : null));
    if (cprEarly !== null && cprRecent !== null && cprEarly > 0) {
      const rise = (cprRecent - cprEarly) / cprEarly;
      if (rise >= o.threshold) { signals.push('cost_per_result_up'); maxDrift = Math.max(maxDrift, rise); }
    }
    // Signal 3: ROAS falling (revenue/spend) — only when revenue is tracked.
    const roasEarly = meanRatio(early, (s) => (s.spend > 0 && s.revenue > 0 ? s.revenue / s.spend : null));
    const roasRecent = meanRatio(recent, (s) => (s.spend > 0 && s.revenue > 0 ? s.revenue / s.spend : null));
    if (roasEarly !== null && roasRecent !== null && roasEarly > 0) {
      const drop = (roasEarly - roasRecent) / roasEarly;
      if (drop >= o.threshold) { signals.push('roas_down'); maxDrift = Math.max(maxDrift, drop); }
    }
  }

  // The skill's core rule: flag ONLY on 2+ combined signals.
  if (signals.length >= 2) {
    return { status: 'fatigued', signals, severity: severityFromDrift(maxDrift), drift: maxDrift, daysLive: daysLive(snaps), note: fatigueNote(signals, maxDrift) };
  }
  return { status: 'healthy', signals, severity: null, drift: maxDrift, daysLive: daysLive(snaps), note: 'ללא סימני עייפות משמעותיים' };
}

/** Rank a batch of verdicts fatigued-first, worst drift on top (for the RTL report). */
export function rankFatigue<T extends { verdict: FatigueVerdict }>(rows: T[]): T[] {
  const order = { fatigued: 0, healthy: 1, insufficient_data: 2 } as const;
  return [...rows].sort((a, b) => {
    const s = order[a.verdict.status] - order[b.verdict.status];
    return s !== 0 ? s : b.verdict.drift - a.verdict.drift;
  });
}

// ── helpers ──
function meanRatio(snaps: FatigueSnapshot[], f: (s: FatigueSnapshot) => number | null): number | null {
  const vals = snaps.map(f).filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function severityFromDrift(drift: number): FatigueSeverity {
  if (drift >= 0.4) return 'high';
  if (drift >= 0.25) return 'medium';
  return 'low';
}

function daysLive(snaps: FatigueSnapshot[]): number | null {
  if (snaps.length < 2) return null;
  const first = Date.parse(snaps[0].asOf);
  const last = Date.parse(snaps[snaps.length - 1].asOf);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  return Math.max(0, Math.round((last - first) / 86_400_000));
}

function fatigueNote(signals: FatigueSignal[], drift: number): string {
  const pct = Math.round(drift * 100);
  const has = (s: FatigueSignal) => signals.includes(s);
  if (has('ctr_down') && has('cost_per_result_up')) return `CTR יורד והעלות-לתוצאה עולה (~${pct}%) — הקהל שבע, שקול רענון`;
  if (has('ctr_down') && has('roas_down')) return `CTR ו-ROAS יורדים יחד (~${pct}%) — הקריאייטיב מאבד אפקטיביות`;
  return `${signals.length} סימני-דעיכה יחד (~${pct}%) — מועמד לרענון`;
}
