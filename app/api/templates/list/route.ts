// GET /api/templates/list?workspace= — merged WhatsApp catalog for the management UI:
// built-in (lib/templates/whatsapp-catalog) ∪ workspace customs. Each item is tagged
// source: 'builtin' | 'custom' + overrides:boolean so the UI can mark customs that
// shadow a built-in key. WhatsApp-only in this product (no email/canned).
import { NextRequest, NextResponse } from 'next/server';
import { TEMPLATES } from '@/lib/templates/whatsapp-catalog';
import { mergedWhatsAppTemplates, listCustom } from '@/lib/templates/custom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace') || process.env.DEFAULT_WORKSPACE_ID;
  if (!workspaceId) return NextResponse.json({ error: 'workspace required' }, { status: 400 });

  const builtinWa = new Set(Object.keys(TEMPLATES));

  const [waMerged, waCustomRows] = await Promise.all([
    mergedWhatsAppTemplates(workspaceId),
    listCustom(workspaceId, 'whatsapp'),
  ]);
  const waCustomKeys = new Set(waCustomRows.map((r) => (r as { key: string }).key));

  const whatsapp = Object.entries(waMerged).map(([key, d]) => ({
    key,
    name: d.name,
    language: d.language,
    category: d.category,
    body: d.body,
    params: d.params,
    sampleParams: d.sampleParams,
    quickReply: (d as { quickReply?: string[] }).quickReply ?? null,
    urlButton: d.urlButton ?? null,
    source: waCustomKeys.has(key) ? 'custom' : 'builtin',
    overrides: waCustomKeys.has(key) && builtinWa.has(key),
  }));

  return NextResponse.json({ whatsapp });
}
