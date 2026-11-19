import type { Metadata } from 'next';
import { Nunito_Sans } from 'next/font/google';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { brand } from '@/lib/brand';
import { serverEnv } from '@/lib/env';
import './globals.css';

// The brand font (DESIGN.md §7.1). next/font downloads it at build time and serves it from
// our own origin, so browsers never call Google. Only the latin file is preloaded; the ₱ sign
// lives in latin-ext, whose file the browser fetches on its own when a price is on screen.
const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-nunito-sans',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    // Relative URLs in metadata (canonical, Open Graph) become absolute on this origin.
    metadataBase: new URL(serverEnv().SITE_URL),
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: t('description'),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={nunitoSans.variable}>
      {/*
        Server Components get UI strings with getTranslations(). Once a Client Component
        needs strings, wrap it in <NextIntlClientProvider messages={…}> with only its
        namespace; providing all messages here would ship every string on every page.
      */}
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
