import type { AdConnector } from './types';
import { metaConnector } from './meta';
import { tiktokConnector } from './tiktok';
import { googleConnector } from './google';
import { outbrainConnector } from './outbrain';

export type {
  AdConnector,
  AdRef,
  CreativeUpload,
  UploadResult,
  InsightRow,
  ChannelConfig,
  CampaignSpec,
  CampaignObjective,
  CampaignResult,
  CampaignAudience,
  CampaignCreative,
} from './types';

// Map a creative's `platform` label (however it's spelled, EN or HE) to its connector.
// The channel_connections.config row is looked up by the SAME label in the engine.
const BY_ALIAS: Record<string, AdConnector> = {
  meta: metaConnector,
  facebook: metaConnector,
  instagram: metaConnector,
  fb: metaConnector,
  ig: metaConnector,
  'פייסבוק': metaConnector,
  'אינסטגרם': metaConnector,
  tiktok: tiktokConnector,
  'טיקטוק': tiktokConnector,
  google: googleConnector,
  'google ads': googleConnector,
  youtube: googleConnector,
  'גוגל': googleConnector,
  outbrain: outbrainConnector,
  'אאוטבריין': outbrainConnector,
};

/** Resolve the connector for a platform label, or null if we don't support it. */
export function getConnector(platform: string): AdConnector | null {
  return BY_ALIAS[platform?.trim().toLowerCase()] ?? BY_ALIAS[platform?.trim()] ?? null;
}

/** Platforms with a real management connector (for UI hints / capability checks). */
export const SUPPORTED_PLATFORMS = ['Meta', 'TikTok', 'Google', 'Outbrain'] as const;
