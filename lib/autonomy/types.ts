// HELIX Autonomy Switch — canonical types. Source: helix/PRODUCTS/autonomy-reference.

export type AutonomyMode = 'advisor' | 'approve' | 'autopilot';
export type RiskClass = 'internal' | 'outbound' | 'money' | 'tos';

export const RISK_BY_FEATURE: Record<string, RiskClass> = {
  'ops.engagement': 'tos',
  'ops.ads': 'money',
  'ops.campaign_publish': 'outbound',
  'ops.radar_outreach': 'outbound',
  'ops.landing_publish': 'internal',
};

export function riskOf(featureKey: string): RiskClass {
  return RISK_BY_FEATURE[featureKey] ?? 'outbound';
}

export function needsRiskAck(featureKey: string): boolean {
  return riskOf(featureKey) !== 'internal';
}
