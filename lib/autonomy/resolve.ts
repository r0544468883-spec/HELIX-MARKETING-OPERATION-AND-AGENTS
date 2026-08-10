// HELIX Autonomy Switch — mode resolution. Fail-safe & downgrade-only.

import type { AutonomyMode } from './types';
import { needsRiskAck } from './types';

export interface AutonomyStore {
  getSettings(
    workspaceId: string,
    featureKey: string,
  ): Promise<{ mode: AutonomyMode; risk_ack: boolean } | null>;
}

export async function resolveMode(
  store: AutonomyStore,
  workspaceId: string,
  featureKey: string,
): Promise<AutonomyMode> {
  let row: { mode: AutonomyMode; risk_ack: boolean } | null = null;
  try {
    row = await store.getSettings(workspaceId, featureKey);
  } catch {
    return 'advisor';
  }
  if (!row) return 'advisor';
  if (row.mode === 'autopilot' && needsRiskAck(featureKey) && !row.risk_ack) {
    return 'approve';
  }
  return row.mode;
}

// Legacy adapter: OPS performance module's two controls → canonical mode.
export function fromOpsPerformance(
  executionMode: 'brain' | 'connector',
  autonomy: 'approve' | 'autopilot',
): AutonomyMode {
  if (executionMode === 'brain') return 'advisor';
  return autonomy === 'autopilot' ? 'autopilot' : 'approve';
}
