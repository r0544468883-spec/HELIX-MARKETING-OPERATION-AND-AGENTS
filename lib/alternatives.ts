import type { SupabaseClient } from '@supabase/supabase-js';
import { toolSlug } from './slugify';

export type AltProduct = {
  name: string;
  slug: string;
  tagline: string;
  logo_url: string | null;
  status: string;
  alternative_to: string[];
  launches: { id: string; votes_count: number; comments_count: number; launch_date: string }[];
};

/** אוסף את כל המוצרים עם תיוג alternative_to (עמוד ריק אם אין) */
export async function fetchAltProducts(supabase: SupabaseClient): Promise<AltProduct[]> {
  const { data } = await supabase
    .from('products')
    .select(
      'name, slug, tagline, logo_url, status, alternative_to, launches(id, votes_count, comments_count, launch_date)'
    )
    .not('alternative_to', 'eq', '{}')
    .limit(500);
  return (data ?? []) as AltProduct[];
}

/** מקבץ לפי שם הכלי הגלובלי: {slug, name, count} ממוין לפי כמות */
export function groupTools(products: AltProduct[]) {
  const map = new Map<string, { name: string; count: number }>();
  for (const p of products) {
    for (const raw of p.alternative_to ?? []) {
      const name = raw.trim();
      if (!name) continue;
      const slug = toolSlug(name);
      const entry = map.get(slug) ?? { name, count: 0 };
      entry.count += 1;
      map.set(slug, entry);
    }
  }
  return Array.from(map.entries())
    .map(([slug, v]) => ({ slug, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);
}
