// track-visitor — receives UTM + visitor data from the client and upserts into
// mkt_visitors. City is detected FREE from Cloudflare headers (Supabase Edge runs
// on Cloudflare) — no geo API key. Part 1 of the attribution loop; the payment
// webhook later flips payment_status='paid' on the matching visitor.
// Harvested & rewritten (MIT) from krishna-build/claude-coach-kit.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-visitor-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // City/region/country from Cloudflare headers (free, automatic), with fallbacks.
    const h = (k: string) => req.headers.get(k) || req.headers.get(k.toLowerCase()) || "";
    const dec = (s: string) => (s ? decodeURIComponent(s) : "");
    const city = dec(h("CF-IPCity") || h("X-City") || body.city || "");
    const region = dec(h("CF-IPRegion") || h("X-Region") || body.region || "");
    const country = dec(h("CF-IPCountry") || body.country || "");

    const visitorId = body.visitor_id || `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const { data: existing } = await supabase
      .from("mkt_visitors").select("id, city").eq("visitor_id", visitorId).maybeSingle();

    if (existing) {
      const updates: Record<string, string> = {};
      if (city && !existing.city) updates.city = city;
      if (region) updates.region = region;
      if (country) updates.country = country;
      if (Object.keys(updates).length) await supabase.from("mkt_visitors").update(updates).eq("visitor_id", visitorId);
    } else {
      await supabase.from("mkt_visitors").insert({
        workspace_id: body.workspace_id ?? null,
        visitor_id: visitorId,
        utm_source: body.utm_source ?? null,
        utm_medium: body.utm_medium ?? null,
        utm_campaign: body.utm_campaign ?? null,
        utm_content: body.utm_content ?? null,
        utm_term: body.utm_term ?? null,
        city, region, country,
        device: body.device ?? "",
        page_url: body.page_url ?? null,
        first_visit: body.first_visit ?? new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({ ok: true, visitor_id: visitorId, city, region }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});
