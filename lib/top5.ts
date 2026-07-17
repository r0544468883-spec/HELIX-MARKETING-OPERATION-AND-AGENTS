import type { SupabaseClient } from '@supabase/supabase-js';

export type Top5Item = {
  launchId: string;
  votes: number;
  name: string;
  slug: string;
  tagline: string;
  logoUrl: string | null;
  status: string;
};

export type CategorySection = {
  id: number;
  slug: string;
  name_he: string;
  name_en: string;
  count: number;
  items: Top5Item[];
};

/**
 * שאילתה אחת לכל ההשקות (ממוינות לפי הצבעות) + קיבוץ ב-JS
 * לטופ-5 פר קטגוריה. קטגוריות ריקות מדולגות, הסדר לפי כמות מוצרים.
 */
export async function getTop5ByCategory(supabase: SupabaseClient): Promise<CategorySection[]> {
  const { data: categories } = await supabase
    .from('categories')
    .select('id, slug, name_he, name_en')
    .order('id');

  const { data: launches } = await supabase
    .from('launches')
    .select(
      'id, votes_count, products!inner(id, name, slug, tagline, logo_url, status, product_categories(category_id))'
    )
    .order('votes_count', { ascending: false })
    .limit(300);

  const byCategory = new Map<number, { count: number; seen: Set<string>; items: Top5Item[] }>();

  for (const l of launches ?? []) {
    const raw = (l as Record<string, unknown>).products;
    const p = (Array.isArray(raw) ? raw[0] : raw) as {
      id: string;
      name: string;
      slug: string;
      tagline: string;
      logo_url: string | null;
      status: string;
      product_categories: { category_id: number }[] | null;
    } | null;
    if (!p) continue;

    for (const pc of p.product_categories ?? []) {
      const entry =
        byCategory.get(pc.category_id) ?? { count: 0, seen: new Set<string>(), items: [] };
      if (entry.seen.has(p.id)) continue;
      entry.seen.add(p.id);
      entry.count += 1;
      if (entry.items.length < 5) {
        entry.items.push({
          launchId: (l as { id: string }).id,
          votes: (l as { votes_count: number }).votes_count,
          name: p.name,
          slug: p.slug,
          tagline: p.tagline,
          logoUrl: p.logo_url,
          status: p.status,
        });
      }
      byCategory.set(pc.category_id, entry);
    }
  }

  return (categories ?? [])
    .map((c) => ({
      ...c,
      count: byCategory.get(c.id)?.count ?? 0,
      items: byCategory.get(c.id)?.items ?? [],
    }))
    .filter((c) => c.items.length > 0)
    .sort((a, b) => b.count - a.count);
}
