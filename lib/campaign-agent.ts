// Campaign Agent — builds a full cross-channel campaign from one brief. Per channel
// it produces the RIGHT asset shape: social/LinkedIn get A/B copy variants; Google
// Ads gets an RSA (headlines+descriptions+keywords); SEO gets a keyword plan + brief.
// Reuses the Content Agent's variant generator + skills-marketing intent.
import { claude } from './engagement/ai';
import { generateChannelVariants, type Variant } from './content-agent';

// Channel key → Hebrew label used by the Content Agent's channel guide.
const SOCIAL_LABEL: Record<string, string> = {
  facebook: 'פייסבוק', instagram: 'אינסטגרם', linkedin: 'לינקדאין',
};

export type GoogleRSA = {
  headlines: string[];    // up to 15, ≤30 chars each
  descriptions: string[]; // up to 4, ≤90 chars each
  keywords: string[];     // themed keyword ideas
};
export type SeoPlan = {
  primaryKeyword: string;
  keywords: { term: string; intent: string }[];
  title: string;
  outline: string[];
  // Hub-and-spoke cluster (HELIX SEO/AEO/GEO methodology §9b — OPS is the "Briefer":
  // it plans the cluster + templated briefs and hands publishing to helix-rank).
  cluster?: {
    pillarKeyword: string;
    coinedTerm: string | null; // invented category term to own (methodology §3.2)
    diagram: string;           // signature-diagram concept reused across the cluster
    spokes: { keyword: string; angle: string }[]; // 4-8 long-tail, each links back to the pillar
  };
};

export type ClientProfile = {
  name?: string; audience?: string; voice?: string; product?: string; dos_donts?: string;
};
export type Budget = { total?: number; currency?: string; per_channel?: Record<string, number> };

export type CampaignAsset =
  | { channel: string; kind: 'social'; variants: Variant[] }
  | { channel: string; kind: 'search_ads'; rsa: GoogleRSA }
  | { channel: string; kind: 'seo'; plan: SeoPlan };

export type CampaignResult = { channel: string; asset: CampaignAsset; budget: number | null }[];

// Turn a client profile into a short prompt prefix so every asset speaks to the
// right audience in the right voice.
function personaBrief(brief: string, p?: ClientProfile): string {
  if (!p) return brief;
  const parts = [
    p.name && `לקוח: ${p.name}`,
    p.product && `מוצר/שירות: ${p.product}`,
    p.audience && `קהל יעד: ${p.audience}`,
    p.voice && `טון מותג: ${p.voice}`,
    p.dos_donts && `כללי עשה/אל-תעשה: ${p.dos_donts}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' · ')}\n\nבריף: ${brief}` : brief;
}

// Allocate budget per channel: explicit per_channel wins; else split total evenly.
function allocate(channels: string[], budget?: Budget): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const per = budget?.per_channel ?? {};
  const explicit = channels.filter((c) => typeof per[c] === 'number');
  const remaining = channels.filter((c) => typeof per[c] !== 'number');
  const usedTotal = explicit.reduce((s, c) => s + (per[c] || 0), 0);
  const left = Math.max(0, (budget?.total ?? 0) - usedTotal);
  const split = remaining.length && left > 0 ? Math.round(left / remaining.length) : 0;
  for (const c of channels) out[c] = typeof per[c] === 'number' ? per[c] : (split || null);
  return out;
}

// Robust JSON extraction — the model sometimes wraps JSON in prose/fences.
function parseJson<T>(raw: string, fallback: T): T {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function buildGoogleAds(brief: string, title: string): Promise<GoogleRSA> {
  const raw = await claude(
    'אתה מומחה Google Ads. החזר JSON בלבד במבנה: {"headlines": string[15], "descriptions": string[4], "keywords": string[10]}. כותרות עד 30 תווים, תיאורים עד 90 תווים, בעברית. בלי טקסט נוסף.',
    `מוצר/כותרת: ${title}\nבריף: ${brief}`,
    1200
  );
  const j = parseJson<GoogleRSA>(raw, { headlines: [], descriptions: [], keywords: [] });
  return {
    headlines: (j.headlines ?? []).map((h) => h.slice(0, 30)).slice(0, 15),
    descriptions: (j.descriptions ?? []).map((d) => d.slice(0, 90)).slice(0, 4),
    keywords: (j.keywords ?? []).slice(0, 15),
  };
}

async function buildSeo(brief: string, title: string): Promise<SeoPlan> {
  // Methodology §9b: OPS plans a hub-and-spoke CLUSTER (pillar + spokes + a
  // coined category term + one signature-diagram concept), not a lone keyword.
  // It stays a BRIEF — OPS exports it; helix-rank produces/publishes the pages.
  const raw = await claude(
    'אתה אסטרטג SEO/GEO ברמת-קמפיין. במקום מילת-מפתח בודדת, תכנן אשכול hub-and-spoke. החזר JSON בלבד: {"primaryKeyword": string, "keywords": [{"term": string, "intent": "informational|commercial|transactional"}], "title": string, "outline": string[], "cluster": {"pillarKeyword": string, "coinedTerm": string|null, "diagram": string, "spokes": [{"keyword": string, "angle": string}]}}. בעברית. 8-10 מילות מפתח, outline של 5-8 סעיפים, ו-4-8 spokes ממוקדי long-tail. coinedTerm = מונח-קטגוריה שאפשר לתפוס בלי תחרות (או null אם לא רלוונטי). אל תמציא סטטיסטיקות. בלי טקסט נוסף.',
    `נושא/כותרת: ${title}\nבריף: ${brief}`,
    1600
  );
  const plan = parseJson<SeoPlan>(raw, { primaryKeyword: title, keywords: [], title, outline: [] });
  if (plan.cluster) {
    plan.cluster.spokes = (plan.cluster.spokes ?? []).filter((s) => s && s.keyword).slice(0, 8);
    plan.cluster.coinedTerm = plan.cluster.coinedTerm && plan.cluster.coinedTerm.trim() ? plan.cluster.coinedTerm.trim() : null;
  }
  return plan;
}

// Build the content for ONE channel (the unit of incremental work — the campaign
// builds one channel at a time so results appear progressively, never 108 at once).
export async function buildChannelContent(
  channel: string,
  briefWithPersona: string,
  title: string,
  variationsPerAngle = 6
): Promise<CampaignAsset> {
  if (channel === 'google_ads') return { channel, kind: 'search_ads', rsa: await buildGoogleAds(briefWithPersona, title) };
  if (channel === 'seo') return { channel, kind: 'seo', plan: await buildSeo(briefWithPersona, title) };
  const label = SOCIAL_LABEL[channel] ?? channel;
  const variants = await generateChannelVariants(briefWithPersona, title, label, 6, variationsPerAngle);
  return { channel, kind: 'social', variants };
}

export function assetKind(channel: string): 'social' | 'search_ads' | 'seo' {
  return channel === 'google_ads' ? 'search_ads' : channel === 'seo' ? 'seo' : 'social';
}

// Full parallel build (kept for the bot's one-shot summary path). The UI uses the
// incremental per-channel path instead.
export async function buildCampaign(input: {
  brief: string;
  title: string;
  channels: string[];
  clientProfile?: ClientProfile;
  budget?: Budget;
  variantsPerChannel?: number; // variations PER ANGLE (6 angles × this = total per channel)
}): Promise<CampaignResult> {
  const vPerAngle = input.variantsPerChannel ?? 6;
  const brief = personaBrief(input.brief, input.clientProfile);
  const alloc = allocate(input.channels, input.budget);
  const jobs = input.channels.map(async (channel): Promise<CampaignResult[number]> => ({
    channel, budget: alloc[channel], asset: await buildChannelContent(channel, brief, input.title, vPerAngle),
  }));
  return Promise.all(jobs);
}

// Expose the persona/allocate helpers for the incremental runner.
export { personaBrief, allocate };

export const CAMPAIGN_CHANNELS = [
  { id: 'facebook', label: 'פייסבוק', kind: 'social' },
  { id: 'instagram', label: 'אינסטגרם', kind: 'social' },
  { id: 'linkedin', label: 'לינקדאין', kind: 'social' },
  { id: 'google_ads', label: 'Google Ads', kind: 'search_ads' },
  { id: 'seo', label: 'SEO', kind: 'seo' },
] as const;
