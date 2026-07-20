// email-engine — cron-driven email sequence sender. Finds enrollments whose
// next_send_at is due, renders the current step (merge tags + open/click tracking),
// sends via Resend, logs, and advances to the next step. Respects configurable
// quiet hours. Run on a Supabase scheduled trigger (e.g. every 15 min).
// Harvested & rewritten (MIT) from krishna-build/claude-coach-kit — SMTP→Resend,
// India/Razorpay hardcoding removed, quiet-hours env-driven, RTL-safe template.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("EMAIL_FROM") || "HELIX <hello@example.com>";
const TRACK_BASE = Deno.env.get("TRACK_BASE") || `${SUPABASE_URL}/functions/v1`;
// Quiet hours in UTC (skip sending inside the window). Defaults: 20:00–06:00 UTC.
const QUIET_START = Number(Deno.env.get("QUIET_START_UTC") ?? "20");
const QUIET_END = Number(Deno.env.get("QUIET_END_UTC") ?? "6");
const BATCH = Number(Deno.env.get("EMAIL_BATCH") ?? "20");

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization" };

function inQuietHours(): boolean {
  const hr = new Date().getUTCHours();
  return QUIET_START < QUIET_END ? hr >= QUIET_START && hr < QUIET_END : hr >= QUIET_START || hr < QUIET_END;
}

// RTL-safe wrapper so Hebrew renders correctly in every client.
function wrap(inner: string, pixel: string): string {
  return `<!DOCTYPE html><html dir="rtl" lang="he"><body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px;background:#fff;color:#111;text-align:right">${inner}</div>${pixel}</body></html>`;
}

async function sendResend(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`resend_${res.status}_${await res.text()}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (inQuietHours()) return new Response(JSON.stringify({ status: "idle", reason: "quiet_hours" }), { headers: cors });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const out = { processed: 0, sent: 0, skipped: 0, errors: 0 };

  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("mkt_sequence_enrollments").select("*").eq("status", "active").lte("next_send_at", now).limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  if (!due?.length) return new Response(JSON.stringify({ status: "idle", message: "nothing due" }), { headers: cors });

  for (const en of due) {
    out.processed++;
    try {
      const { data: step } = await supabase
        .from("mkt_sequence_steps").select("*")
        .eq("sequence_id", en.sequence_id).eq("step_order", en.current_step).maybeSingle();

      // No more steps → sequence complete.
      if (!step) {
        await supabase.from("mkt_sequence_enrollments").update({ status: "completed", completed_at: now }).eq("id", en.id);
        out.skipped++; continue;
      }

      const { data: contact } = await supabase.from("mkt_contacts").select("*").eq("id", en.contact_id).maybeSingle();
      if (!contact || contact.status !== "active") { out.skipped++; continue; }

      const trackId = crypto.randomUUID();
      const pixel = `<img src="${TRACK_BASE}/email-track?t=open&id=${trackId}" width="1" height="1" style="display:none" alt="" />`;

      // Rewrite links through the click tracker, then apply merge tags.
      let html = String(step.email_body)
        .replace(/href="(https?:\/\/[^"]+)"/g, (_m, url) => `href="${TRACK_BASE}/email-track?t=click&id=${trackId}&url=${encodeURIComponent(url)}"`)
        .replace(/\{\{first_name\}\}/g, contact.first_name || "שלום")
        .replace(/\{\{email\}\}/g, contact.email)
        .replace(/\{\{phone\}\}/g, contact.phone || "");
      const subject = String(step.email_subject).replace(/\{\{first_name\}\}/g, contact.first_name || "");

      await sendResend(contact.email, subject, wrap(html, pixel));
      out.sent++;

      await supabase.from("mkt_email_log").insert({
        contact_id: contact.id, sequence_id: en.sequence_id, step_id: step.id,
        track_id: trackId, email_to: contact.email, subject, status: "sent", sent_at: new Date().toISOString(),
      });

      // Schedule the next step by its delay, or finish if none.
      const nextOrder = en.current_step + 1;
      const { data: next } = await supabase
        .from("mkt_sequence_steps").select("delay_hours")
        .eq("sequence_id", en.sequence_id).eq("step_order", nextOrder).maybeSingle();
      if (next) {
        const at = new Date(Date.now() + (next.delay_hours ?? 24) * 3600_000).toISOString();
        await supabase.from("mkt_sequence_enrollments").update({ current_step: nextOrder, next_send_at: at }).eq("id", en.id);
      } else {
        await supabase.from("mkt_sequence_enrollments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", en.id);
      }
    } catch (_e) {
      out.errors++;
    }
  }

  return new Response(JSON.stringify({ status: "done", ...out }), { headers: { ...cors, "Content-Type": "application/json" } });
});
