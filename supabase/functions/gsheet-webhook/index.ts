// gsheet-webhook — inbound lead sync from a Google Sheet (via Apps Script) or any
// form. Upserts mkt_contacts, carries UTM, tags as "lead", and can auto-enroll the
// contact into a welcome sequence. Part 3 of the harvest (Google-Sheet sync).
// Harvested & rewritten (MIT) from krishna-build/claude-coach-kit.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
// Optional: auto-enroll new leads into this sequence id (welcome flow).
const WELCOME_SEQUENCE_ID = Deno.env.get("WELCOME_SEQUENCE_ID") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();
    if (!email.includes("@")) return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: cors });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabase.from("mkt_webhook_log").insert({ source: "google_sheet", payload: body, action_taken: "upsert_contact", processed: true });

    const { data: existing } = await supabase.from("mkt_contacts").select("*").eq("email", email).maybeSingle();

    let contactId: string;
    if (existing) {
      // Only fill blanks — never overwrite known-good data with sheet re-imports.
      const u: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of ["first_name", "phone", "utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
        if (body[k] && !existing[k]) u[k] = body[k];
      }
      if (!existing.tags?.includes("lead")) u.tags = [...(existing.tags || []), "lead"];
      await supabase.from("mkt_contacts").update(u).eq("id", existing.id);
      contactId = existing.id;
    } else {
      const { data: created } = await supabase.from("mkt_contacts").insert({
        workspace_id: body.workspace_id ?? null,
        email, first_name: body.first_name ?? null, phone: body.phone ?? null,
        tags: ["lead"],
        utm_source: body.utm_source ?? null, utm_medium: body.utm_medium ?? null,
        utm_campaign: body.utm_campaign ?? null, utm_content: body.utm_content ?? null,
      }).select("id").single();
      contactId = created!.id;

      // Auto-enroll fresh leads into the welcome sequence, if configured.
      if (WELCOME_SEQUENCE_ID) {
        await supabase.from("mkt_sequence_enrollments").insert({
          sequence_id: WELCOME_SEQUENCE_ID, contact_id: contactId, status: "active", current_step: 1, next_send_at: new Date().toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, contact_id: contactId }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors });
  }
});
