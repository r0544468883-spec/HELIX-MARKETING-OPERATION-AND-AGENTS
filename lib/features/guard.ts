import 'server-only';
import { notFound } from 'next/navigation';
import { getFeatureMap } from './server';
import type { FeatureId } from '@/lib/features';

/**
 * Page-level guard: call at the top of a feature's page. If the current workspace
 * has the feature turned off, the route 404s — so a disabled feature can't be
 * reached by typing its URL, matching that it's hidden from the nav.
 */
export async function requireFeature(id: FeatureId): Promise<void> {
  const map = await getFeatureMap();
  if (!map[id]) notFound();
}
