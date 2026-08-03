// Creative scoring — the core of the performance module. PURE math (no I/O), so it
// is trivially testable and runs anywhere. The philosophy (see the product spec):
// scoring is NOT "AI vs the client's data" — it's a 3-layer Bayesian blend where the
// AI cold-start score is the PRIOR and the client's live data is the LIKELIHOOD, and
// the weight shifts from prior→posterior as real data accrues.
//
//   1. cold-start (AI)  — 0..100 predicted potential BEFORE any spend (see cold-start.ts)
//   2. in-flight (data) — 0..100 from live metrics, normalized vs the client's OWN
//                         baseline (relative, not absolute — ₪80 CPA is great in one
//                         vertical, awful in another), gated by statistical confidence
//   3. blended          — dataWeight·inFlight + (1-dataWeight)·coldStart, where
//                         dataWeight = confidence (grows with sample size)

export type Metric = 'cpa' | 'roas' | 'cpl' | 'ctr';

/** Higher metric value = better creative? (roas/ctr yes; cpa/cpl no — cheaper is better) */
export const HIGHER_IS_BETTER: Record<Metric, boolean> = {
  roas: true,
  ctr: true,
  cpa: false,
  cpl: false,
};

export type CreativeMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export const ZERO_METRICS: CreativeMetrics = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  revenue: 0,
};

/** Compute the raw value of the chosen objective metric. null = not enough to compute. */
export function metricValue(m: Metric, x: CreativeMetrics): number | null {
  switch (m) {
    case 'ctr':
      return x.impressions > 0 ? x.clicks / x.impressions : null;
    case 'cpa':
      return x.conversions > 0 ? x.spend / x.conversions : null;
    case 'cpl':
      // CPL treats conversions as leads (same shape as CPA; separate metric so the
      // client can label/threshold leads distinctly from purchases).
      return x.conversions > 0 ? x.spend / x.conversions : null;
    case 'roas':
      return x.spend > 0 ? x.revenue / x.spend : null;
  }
}

/**
 * Statistical confidence that we can trust the live metric yet — 0..1. Grows with
 * the sample that actually matters for the metric: impressions for CTR, conversions
 * for CPA/CPL/ROAS (a ROAS off 2 purchases is noise). This is the dataWeight in the
 * blend, so a fresh creative leans on the AI prior and a proven one on real data.
 */
export function confidence(m: Metric, x: CreativeMetrics): number {
  // Targets = "enough signal to mostly trust it". Tunable per workspace later.
  const TARGET_IMPRESSIONS = 1000;
  const TARGET_CONVERSIONS = 25;
  const sample =
    m === 'ctr'
      ? x.impressions / TARGET_IMPRESSIONS
      : x.conversions / TARGET_CONVERSIONS;
  return clamp01(sample);
}

export type Baseline = { mean: number; spread: number };

/**
 * The client's OWN baseline for a metric — mean and a robust spread across a set of
 * reference values (this workspace's other/prior creatives). Used to score relative
 * to what's normal FOR THIS CLIENT, not an absolute number. Spread falls back to a
 * fraction of the mean when there's too little history to measure dispersion.
 */
export function computeBaseline(values: number[]): Baseline {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length === 0) return { mean: 0, spread: 1 };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (v.length < 2) return { mean, spread: Math.max(Math.abs(mean) * 0.25, 1e-6) };
  const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1);
  const std = Math.sqrt(variance);
  return { mean, spread: std > 0 ? std : Math.max(Math.abs(mean) * 0.25, 1e-6) };
}

/**
 * In-flight score 0..100: how good is this metric value vs the client's baseline.
 * z-score → 50 ± 15·z, inverted for lower-is-better metrics. Clamped to 1..99.
 * Returns null if the metric can't be computed (no data yet).
 */
export function inFlightScore(m: Metric, x: CreativeMetrics, baseline: Baseline): number | null {
  const val = metricValue(m, x);
  if (val === null) return null;
  const z = (val - baseline.mean) / (baseline.spread || 1e-6);
  const signed = HIGHER_IS_BETTER[m] ? z : -z;
  return clamp(1, 99, 50 + 15 * signed);
}

export type ScoreBreakdown = {
  metric: Metric;
  coldStart: number; // 0..100 AI prior
  inFlight: number | null; // 0..100 from data, or null pre-data
  confidence: number; // 0..1 (== dataWeight)
  blended: number; // 0..100 final
  value: number | null; // raw metric value (for display)
};

/**
 * Blend cold-start (prior) with in-flight (likelihood). dataWeight = confidence, so:
 *   fresh creative (conf≈0)  → ≈ cold-start
 *   proven creative (conf≈1) → ≈ in-flight
 */
export function blendScore(
  metric: Metric,
  coldStart: number,
  x: CreativeMetrics,
  baseline: Baseline
): ScoreBreakdown {
  const inFlight = inFlightScore(metric, x, baseline);
  const conf = confidence(metric, x);
  const dataWeight = inFlight === null ? 0 : conf;
  const blended = clamp(1, 99, dataWeight * (inFlight ?? 0) + (1 - dataWeight) * coldStart);
  return {
    metric,
    coldStart: clamp(1, 99, coldStart),
    inFlight,
    confidence: conf,
    blended,
    value: metricValue(metric, x),
  };
}

// ── helpers ──
function clamp(lo: number, hi: number, n: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function clamp01(n: number): number {
  return clamp(0, 1, n);
}
