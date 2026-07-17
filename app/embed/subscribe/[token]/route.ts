export const dynamic = 'force-dynamic';

// טופס הרשמה מוטמע (iframe) — HTML עצמאי, בלי chrome של האתר.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const url = new URL(request.url);
  const he = url.searchParams.get('lang') !== 'en';
  const title = url.searchParams.get('title') || (he ? 'הישארו מעודכנים' : 'Stay in the loop');
  const cta = url.searchParams.get('cta') || (he ? 'הרשמה' : 'Subscribe');
  const placeholder = he ? 'האימייל שלכם' : 'Your email';
  const doneMsg = he ? 'תודה! נרשמתם.' : 'Thanks! You are in.';
  const safeToken = token.replace(/[^a-zA-Z0-9-]/g, '');

  const html = `<!doctype html><html lang="${he ? 'he' : 'en'}" dir="${he ? 'rtl' : 'ltr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:transparent;font-family:system-ui,Segoe UI,Arial,sans-serif;">
<div style="background:#1A1C1B;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;color:#E2E3E1;max-width:420px;">
  <div style="font-weight:800;font-size:17px;margin-bottom:12px;">${title.replace(/</g, '')}</div>
  <form id="f" style="display:flex;gap:8px;flex-wrap:wrap;">
    <input id="e" type="email" required placeholder="${placeholder}" dir="ltr"
      style="flex:1;min-width:160px;background:#121413;border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 14px;color:#E2E3E1;font-size:15px;outline:none;">
    <button type="submit" style="background:#10B981;color:#121413;font-weight:700;border:none;border-radius:10px;padding:10px 18px;font-size:15px;cursor:pointer;">${cta.replace(/</g, '')}</button>
  </form>
  <div id="ok" style="display:none;color:#10B981;font-weight:600;">${doneMsg}</div>
</div>
<script>
  var f=document.getElementById('f');
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    var email=document.getElementById('e').value.trim();
    if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return;
    fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'${safeToken}',email:email})})
      .finally(function(){f.style.display='none';document.getElementById('ok').style.display='block';});
  });
</script>
</body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'frame-ancestors *',
    },
  });
}
