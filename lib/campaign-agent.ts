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
  const raw = await claude(
    'אתה אסטרטג SEO. החזר JSON בלבד: {"primaryKeyword": string, "keywords": [{"term": string, "intent": "informational|commercial|transactional"}], "title": string, "outline": string[]}. בעברית, 8-10 מילות מפתח, outline של 5-8 סעיפים. בלי טקסט נוסף.',
    `נושא/כותרת: ${title}\nבריף: ${brief}`,
    1200
  );
  return parseJson<SeoPlan>(raw, { primaryKeyword: title, keywords: [], title, outline: [] });
}

// Build all requested channels in parallel. Persona tailors copy; budget is
// allocated per channel. `variantsPerChannel` caps A/B variants.
export async function buildCampaign(input: {
  brief: string;
  title: string;
  channels: string[];
  clientProfile?: ClientProfile;
  budget?: Budget;
  variantsPerChannel?: number;
}): Promise<CampaignResult> {
  const n = input.variantsPerChannel ?? 6;
  const brief = personaBrief(input.brief, input.clientProfile);
  const alloc = allocate(input.channels, input.budget);

  const jobs = input.channels.map(async (channel): Promise<CampaignResult[number]> => {
    const budget = alloc[channel];
    if (channel === 'google_ads') {
      return { channel, budget, asset: { channel, kind: 'search_ads', rsa: await buildGoogleAds(brief, input.title) } };
    }
    if (channel === 'seo') {
      return { channel, budget, asset: { channel, kind: 'seo', plan: await buildSeo(brief, input.title) } };
    }
    const label = SOCIAL_LABEL[channel] ?? channel;
    const variants = await generateChannelVariants(brief, input.title, label, n);
    return { channel, budget, asset: { channel, kind: 'social', variants } };
  });

  return Promise.all(jobs);
}

export const CAMPAIGN_CHANNELS = [
  { id: 'facebook', label: 'פייסבוק', kind: 'social' },
  { id: 'instagram', label: 'אינסטגרם', kind: 'social' },
  { id: 'linkedin', label: 'לינקדאין', kind: 'social' },
  { id: 'google_ads', label: 'Google Ads', kind: 'search_ads' },
  { id: 'seo', label: 'SEO', kind: 'seo' },
] as const;
