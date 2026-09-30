import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { brand } from '@/lib/brand';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: { default: brand.name, template: `%s · ${brand.name}` },
    description: t('description'),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      {/*
        Server Components get UI strings with getTranslations(). Once a Client Component
        needs strings, wrap it in <NextIntlClientProvider messages={…}> with only its
        namespace; providing all messages here would ship every string on every page.
      */}
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
