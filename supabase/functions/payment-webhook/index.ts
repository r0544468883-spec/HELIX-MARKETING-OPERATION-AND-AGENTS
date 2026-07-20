// payment-webhook — generic (Stripe-shaped) payment receiver that CLOSES the
// attribution loop: records the payment and flips payment_status='paid' on the
// matching mkt_visitors row (by visitor_id) and mkt_contacts (by email). This is
// what turns UTM tracking into real ROI-per-campaign on the Attribution view.
// Harvested & rewritten (MIT) from krishna-build/claude-coach-kit — Razorpay→generic.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Normalise across providers. Stripe: body.data.object holds the session/charge.
    const obj = body?.data?.object ?? body;
    const provider = body.provider || (body.type?.startsWith?.("checkout") ? "stripe" : "manual");
    const externalId = obj.id || body.external_id || crypto.randomUUID();
    const email = (obj.customer_email || obj.email || body.email || "").toLowerCase().trim();
    const amount = Number(obj.amount_total ?? obj.amount ?? body.amount ?? 0) / (obj.amount_total ? 100 : 1);
    const currency = (obj.currency || body.currency || "ILS").toUpperCase();
    const status = obj.payment_status === "paid" || body.status === "paid" ? "paid" : (body.status || "paid");
    // visitor_id may be passed via client_reference_id / metadata for attribution.
    const visitorId = obj.client_reference_id || obj.metadata?.visitor_id || body.visitor_id || null;

    await supabase.from("mkt_webhook_log").insert({ source: provider, payload: body, action_taken: "payment", processed: true });

    await supabase.from("mkt_payments").upsert({
      provider, external_id: externalId, email, amount, currency, status, visitor_id: visitorId, raw: body,
    }, { onConflict: "external_id" });

    if (status === "paid") {
      const paidAt = new Date().toISOString();
      if (visitorId) {
        await supabase.from("mkt_visitors")
          .update({ payment_status: "paid", payment_amount: amount, paid_at: paidAt }).eq("visitor_id", visitorId);
      }
      if (email) {
        // Tag the contact as customer + stop nurture sequences (they converted).
        const { data: c } = await supabase.from("mkt_contacts").select("id, tags").eq("email", email).maybeSingle();
        if (c) {
          const tags = Array.from(new Set([...(c.tags || []), "customer"]));
          await supabase.from("mkt_contacts").update({ tags, updated_at: paidAt }).eq("id", c.id);
          await supabase.from("mkt_sequence_enrollments").update({ status: "stopped" }).eq("contact_id", c.id).eq("status", "active");
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});
