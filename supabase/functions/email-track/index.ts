// email-track — open/click/unsubscribe tracking for sequence emails.
//   ?t=open  &id=<track_id>            → mark opened, return 1x1 gif
//   ?t=click &id=<track_id> &url=<u>   → mark clicked, 302 to url
//   ?t=unsub &email=<e>                → unsubscribe + stop active enrollments
// Harvested & rewritten (MIT) from krishna-build/claude-coach-kit.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff,
  0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("t");
  const trackId = url.searchParams.get("id");
  const redirect = url.searchParams.get("url");
  const email = url.searchParams.get("email");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (type === "open" && trackId) {
      await supabase.from("mkt_email_log")
        .update({ opened_at: new Date().toISOString(), status: "opened" })
        .eq("track_id", trackId).is("opened_at", null);
      return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
    }

    if (type === "click" && trackId) {
      await supabase.from("mkt_email_log")
        .update({ clicked_at: new Date().toISOString(), status: "clicked" }).eq("track_id", trackId);
      // A click implies an open — record it if not already.
      await supabase.from("mkt_email_log")
        .update({ opened_at: new Date().toISOString() }).eq("track_id", trackId).is("opened_at", null);
      if (redirect) return new Response(null, { status: 302, headers: { Location: decodeURIComponent(redirect) } });
      return new Response("ok");
    }

    if (type === "unsub" && email) {
      const e = decodeURIComponent(email);
      await supabase.from("mkt_contacts").update({ status: "unsubscribed" }).eq("email", e);
      const { data: c } = await supabase.from("mkt_contacts").select("id").eq("email", e).maybeSingle();
      if (c) await supabase.from("mkt_sequence_enrollments").update({ status: "stopped" }).eq("contact_id", c.id).eq("status", "active");
      return new Response(
        `<!DOCTYPE html><html dir="rtl" lang="he"><body style="background:#0f1117;color:#fff;font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h2>הוסרת מרשימת התפוצה</h2><p style="color:#888">לא תקבל/י יותר מיילים מאיתנו.</p></div></body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }
  } catch (_e) { /* swallow — tracking must never error the pixel/redirect */ }

  return new Response("ok");
});
