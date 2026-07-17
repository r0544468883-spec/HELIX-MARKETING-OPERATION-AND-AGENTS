// כלי דיוור: הזרקת פיקסל פתיחה, שכתוב קישורים למעקב הקלקות, ופוטר הסרה.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://helix-stage.vercel.app';

// שכתוב כל href למעבר דרך מעקב הקלקות
function rewriteLinks(html: string, sendId: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_m, url) => {
    const tracked = `${SITE}/api/email/click?s=${sendId}&u=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });
}

// גוף מייל מלא: תוכן + פיקסל פתיחה + פוטר הסרה, בעטיפת HTML כהה בסגנון המותג
export function buildEmailHtml(opts: {
  bodyHtml: string;
  sendId: string;
  subject: string;
  unsubscribeLabel: string;
}): string {
  const body = rewriteLinks(opts.bodyHtml, opts.sendId);
  const pixel = `<img src="${SITE}/api/email/open?s=${opts.sendId}" width="1" height="1" alt="" style="display:none" />`;
  const unsub = `${SITE}/api/email/unsubscribe?s=${opts.sendId}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#121413;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;color:#E2E3E1;">
    <div style="font-size:20px;font-weight:900;color:#E2E3E1;margin-bottom:24px;">HELIX STAGE<span style="color:#10B981;">.</span></div>
    <div style="font-size:15px;line-height:1.6;color:#E2E3E1;">${body}</div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);font-size:12px;color:#869489;">
      <a href="${unsub}" style="color:#869489;">${opts.unsubscribeLabel}</a>
    </div>
  </div>
  ${pixel}
</body></html>`;
}
