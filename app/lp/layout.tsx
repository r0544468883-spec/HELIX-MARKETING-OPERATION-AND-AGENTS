import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = { title: 'HELIX' };

// Root layout for public landing pages (outside the [locale] tree). RTL Hebrew.
export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
