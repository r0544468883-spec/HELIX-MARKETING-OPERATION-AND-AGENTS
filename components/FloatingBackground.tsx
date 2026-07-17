import { createClient } from '@/lib/supabase/server';

// 26 מיקומים פרוסים על כל המסך (כמו FloatingLogos של HELIX)
const positions = [
  { top: '4%', left: '3%', size: 40, dur: 7.2, delay: 0, opacity: 0.16 },
  { top: '9%', left: '22%', size: 34, dur: 9.1, delay: 1.3, opacity: 0.12 },
  { top: '6%', left: '45%', size: 44, dur: 6.8, delay: 2.7, opacity: 0.14 },
  { top: '3%', left: '68%', size: 36, dur: 8.4, delay: 0.5, opacity: 0.13 },
  { top: '8%', left: '87%', size: 42, dur: 7.6, delay: 3.1, opacity: 0.15 },
  { top: '22%', left: '8%', size: 38, dur: 10.2, delay: 1.8, opacity: 0.11 },
  { top: '18%', left: '33%', size: 30, dur: 8.9, delay: 0.2, opacity: 0.1 },
  { top: '25%', left: '58%', size: 46, dur: 7.4, delay: 4.0, opacity: 0.14 },
  { top: '20%', left: '78%', size: 40, dur: 9.6, delay: 2.2, opacity: 0.12 },
  { top: '20%', left: '94%', size: 32, dur: 6.5, delay: 1.0, opacity: 0.15 },
  { top: '38%', left: '1%', size: 42, dur: 8.2, delay: 3.5, opacity: 0.13 },
  { top: '42%', left: '18%', size: 34, dur: 7.8, delay: 0.8, opacity: 0.11 },
  { top: '35%', left: '42%', size: 28, dur: 11.0, delay: 2.4, opacity: 0.09 },
  { top: '40%', left: '65%', size: 44, dur: 8.6, delay: 1.6, opacity: 0.14 },
  { top: '36%', left: '88%', size: 36, dur: 7.1, delay: 4.3, opacity: 0.12 },
  { top: '55%', left: '6%', size: 32, dur: 9.4, delay: 0.4, opacity: 0.11 },
  { top: '58%', left: '26%', size: 42, dur: 7.9, delay: 2.9, opacity: 0.15 },
  { top: '52%', left: '50%', size: 34, dur: 8.7, delay: 1.1, opacity: 0.1 },
  { top: '60%', left: '73%', size: 48, dur: 6.3, delay: 3.7, opacity: 0.16 },
  { top: '56%', left: '91%', size: 30, dur: 10.5, delay: 0.7, opacity: 0.11 },
  { top: '72%', left: '2%', size: 40, dur: 8.1, delay: 2.1, opacity: 0.13 },
  { top: '75%', left: '20%', size: 44, dur: 7.5, delay: 4.6, opacity: 0.14 },
  { top: '70%', left: '44%', size: 32, dur: 9.2, delay: 1.4, opacity: 0.1 },
  { top: '78%', left: '66%', size: 40, dur: 7.3, delay: 3.2, opacity: 0.12 },
  { top: '74%', left: '86%', size: 36, dur: 8.8, delay: 0.9, opacity: 0.15 },
  { top: '88%', left: '10%', size: 34, dur: 6.9, delay: 2.6, opacity: 0.11 },
];

// לוגואים של חברות/כלים — ממלאים את הרקע עד שיצטברו מספיק לוגואים של מוצרי משתמשים
// (בדיוק כמו FloatingLogos באתר HELIX). ככל שיעלו יותר מוצרים, הם ידחקו את אלה החוצה.
const companyLogos = [
  '/logos/claude.png', '/logos/cursor.png', '/logos/figma.png', '/logos/make.png',
  '/logos/n8n.png', '/logos/zapier.png', '/logos/meta.png', '/logos/google-ads.png',
  '/logos/semrush.png', '/logos/wordpress.png', '/logos/shopify.png', '/logos/hubspot.png',
  '/logos/openai.png', '/logos/canva.png', '/logos/tiktok.png', '/logos/linkedin.png',
  '/logos/gemini.png', '/logos/ahrefs.png', '/logos/apollo.png', '/logos/aws.png',
  '/logos/github.png', '/logos/hotjar.png', '/logos/nextjs.png', '/logos/woocommerce.png',
  '/logos/gcp.png', '/logos/python.png',
];

// בלובים ירוקים עדינים — נותנים חיים לרקע גם כשיש מעט מוצרים
const blobs = [
  { top: '12%', left: '78%', size: 340, dur: 12, delay: 0, color: 'rgba(16,185,129,0.06)' },
  { top: '58%', left: '4%', size: 300, dur: 14, delay: 2, color: 'rgba(22,255,171,0.05)' },
  { top: '80%', left: '62%', size: 360, dur: 13, delay: 4, color: 'rgba(16,185,129,0.05)' },
];

export default async function FloatingBackground() {
  let logos: string[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('products')
      .select('logo_url')
      .not('logo_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(26);
    logos = (data ?? []).map((p: { logo_url: string }) => p.logo_url).filter(Boolean);
  } catch {
    // אין חיבור — נשארים עם לוגואי החברות
  }

  // מוצרי המשתמשים קודם, ולוגואי החברות ממלאים את שאר המקומות עד 26
  const filled = [...logos];
  for (const cl of companyLogos) {
    if (filled.length >= positions.length) break;
    filled.push(cl);
  }

  return (
    <div className="stage-bg" aria-hidden="true">
      {blobs.map((b, i) => (
        <div
          key={`blob-${i}`}
          className="stage-bg-blob"
          style={{
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            background: b.color,
            animationDuration: `${b.dur}s`,
            animationDelay: `-${b.delay}s`,
          }}
        />
      ))}
      {filled.map((url, i) => {
        const p = positions[i];
        if (!p) return null;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`logo-${i}`}
            src={url}
            alt=""
            className="stage-bg-logo"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDuration: `${p.dur}s`,
              animationDelay: `-${p.delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
