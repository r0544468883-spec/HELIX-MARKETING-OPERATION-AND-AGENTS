import type { Section, UxStyle } from '@/lib/landing/types';
import LeadForm from './LeadForm';

// UX styles → theme tokens. One structured template, five looks.
const THEME: Record<UxStyle, { bg: string; ink: string; accent: string; heading: string; card: string }> = {
  minimal: { bg: '#ffffff', ink: '#0f1729', accent: '#059669', heading: 'font-black tracking-tight', card: 'border border-black/10 bg-white' },
  bold: { bg: '#0b1220', ink: '#ffffff', accent: '#f59e0b', heading: 'font-black tracking-tight uppercase', card: 'border border-white/10 bg-white/5' },
  luxury: { bg: '#faf7f2', ink: '#1c1917', accent: '#b08d57', heading: 'font-semibold tracking-tight', card: 'border border-[#b08d57]/30 bg-white' },
  dark: { bg: '#0f1117', ink: '#e8edf2', accent: '#10b981', heading: 'font-black tracking-tight', card: 'border border-white/10 bg-white/[0.03]' },
  editorial: { bg: '#fffdf8', ink: '#1a1a1a', accent: '#111827', heading: 'font-black tracking-tight', card: 'border-b-2 border-black/10 bg-transparent' },
};

// Renders an ordered list of typed blocks with the chosen UX theme. RTL, mobile-first.
export default function LandingRenderer({ slug, sections, uxStyle }: { slug: string; sections: Section[]; uxStyle: UxStyle }) {
  const t = THEME[uxStyle] ?? THEME.minimal;
  return (
    <div dir="rtl" style={{ background: t.bg, color: t.ink }} className="min-h-screen">
      <div className="max-w-[860px] mx-auto px-5 md:px-8">
        {sections.map((s, i) => (
          <section key={i} className="py-12 md:py-16">
            {s.type === 'hero' && (
              <div className="text-center">
                <h1 className={`text-[clamp(30px,7vw,56px)] leading-[1.05] mb-4 ${t.heading}`}>{s.headline}</h1>
                <p className="text-[clamp(16px,3vw,20px)] opacity-80 mb-7 max-w-[620px] mx-auto">{s.sub}</p>
                <a href="#form" className="inline-block rounded-xl px-8 py-3.5 text-[17px] font-bold text-white" style={{ background: t.accent }}>{s.cta_label}</a>
              </div>
            )}
            {s.type === 'benefits' && (
              <div>
                <h2 className={`text-[clamp(22px,4vw,32px)] text-center mb-6 ${t.heading}`}>{s.title}</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {s.items.map((it, j) => (
                    <div key={j} className={`rounded-2xl p-5 ${t.card}`}>
                      <div className="text-[17px] font-bold mb-1" style={{ color: t.accent }}>{it.title}</div>
                      <div className="text-[15px] opacity-80">{it.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s.type === 'video' && s.video_url && (
              <div className="text-center">
                <h2 className={`text-[clamp(22px,4vw,32px)] mb-5 ${t.heading}`}>{s.title}</h2>
                <video src={s.video_url} controls className="w-full max-w-[720px] mx-auto rounded-2xl" />
              </div>
            )}
            {s.type === 'proof' && (
              <div>
                <h2 className={`text-[clamp(22px,4vw,32px)] text-center mb-6 ${t.heading}`}>{s.title}</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {s.testimonials.map((q, j) => (
                    <div key={j} className={`rounded-2xl p-5 ${t.card}`}>
                      <div className="text-[16px] mb-2">“{q.quote}”</div>
                      <div className="text-[13px] font-bold opacity-70">— {q.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s.type === 'faq' && (
              <div className="max-w-[680px] mx-auto">
                <h2 className={`text-[clamp(22px,4vw,32px)] text-center mb-6 ${t.heading}`}>{s.title}</h2>
                {s.items.map((it, j) => (
                  <details key={j} className="border-b border-current/10 py-3">
                    <summary className="font-bold cursor-pointer">{it.q}</summary>
                    <p className="mt-2 text-[15px] opacity-80">{it.a}</p>
                  </details>
                ))}
              </div>
            )}
            {s.type === 'cta' && (
              <div className="text-center rounded-2xl p-8" style={{ background: `${t.accent}12` }}>
                <h2 className={`text-[clamp(22px,4vw,32px)] mb-4 ${t.heading}`}>{s.headline}</h2>
                <a href="#form" className="inline-block rounded-xl px-8 py-3.5 text-[17px] font-bold text-white" style={{ background: t.accent }}>{s.cta_label}</a>
              </div>
            )}
            {s.type === 'form' && (
              <div id="form"><LeadForm slug={slug} title={s.title} fields={s.fields} submitLabel={s.submit_label} accent={t.accent} /></div>
            )}
          </section>
        ))}
        <footer className="py-8 text-center text-[12px] opacity-50">Powered by HELIX</footer>
      </div>
    </div>
  );
}
