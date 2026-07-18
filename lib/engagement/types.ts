// Shared types for the engagement engine.

export type RiskLevel = 'green' | 'amber' | 'red';

export type EngagementLimit = {
  id: string;
  workspace_id: string;
  channel: string;
  daily_cap: number;
  used_today: number;
  used_date: string; // 'YYYY-MM-DD'
  warmup_stage: number;
  last_action_at: string | null;
  risk_level: RiskLevel;
  paused: boolean;
};

export type CommentFunnel = {
  id: string;
  workspace_id: string;
  channel: string;
  post_id: string | null;
  keyword: string;
  public_reply_text: string;
  dm_message: string;
  dm_flow: unknown[];
  tier: 'compliant' | 'risk';
  active: boolean;
};

export type TemplateVars = Record<string, string>;
