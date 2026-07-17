import type { Metadata } from 'next';
import { Heebo, Rubik, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import '../globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import SmoothScroll from '@/components/SmoothScroll';
import CursorTrail from '@/components/CursorTrail';
import FloatingBackground from '@/components/FloatingBackground';
import Providers from '@/components/Providers';
import { getDict, isRtl, locales, type Locale } from '@/lib/i18n';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-heebo',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '700', '900'],
  variable: '--font-rubik',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getDict(locale);
  return { title: t.meta.title, description: t.meta.description };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  const t = getDict(locale);

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'}>
      <body
        className={`${heebo.className} ${heebo.variable} ${rubik.variable} ${jetbrains.variable} bg-bg text-ink min-h-screen flex flex-col`}
      >
        <a href="#main-content" className="skip-nav">
          {t.nav.skipToContent}
        </a>
        <SmoothScroll />
        <CursorTrail />
        <FloatingBackground />
        <Nav locale={locale} />
        <main id="main-content" className="relative z-10 flex-1">
          <Providers>{children}</Providers>
        </main>
        <div className="relative z-10">
          <Footer locale={locale} />
        </div>
      </body>
    </html>
  );
}
