import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// תג SVG להטמעה: "Featured on HELIX STAGE" + מספר הצבעות. נטען כתמונה מכל אתר.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') ?? '';

  let votes = 0;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && anon && slug) {
      const supabase = createClient(supabaseUrl, anon);
      const { data } = await supabase
        .from('products')
        .select('launches(votes_count)')
        .eq('slug', slug)
        .maybeSingle();
      const launches = (data?.launches ?? []) as { votes_count: number }[];
      votes = launches[0]?.votes_count ?? 0;
    }
  } catch {
    // נשארים עם 0
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="54" viewBox="0 0 220 54" role="img" aria-label="Featured on HELIX STAGE">
  <rect width="220" height="54" rx="12" fill="#1A1C1B" stroke="#10B981" stroke-opacity="0.4"/>
  <text x="16" y="22" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1" fill="#869489">FEATURED ON</text>
  <text x="16" y="40" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900" fill="#E2E3E1">HELIX STAGE<tspan fill="#10B981">.</tspan></text>
  <g transform="translate(176, 15)">
    <path d="M12 0 L24 22 L0 22 Z" fill="#10B981" opacity="0.15"/>
    <path d="M12 4 L20 18 L4 18 Z" fill="none" stroke="#10B981" stroke-width="1.5"/>
    <text x="12" y="34" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#10B981" text-anchor="middle">${votes}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
