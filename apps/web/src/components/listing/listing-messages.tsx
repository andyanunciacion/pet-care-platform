import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * Gives the clinic page's Client Components (status, hours table, directions) their strings,
 * shipping only those namespaces instead of every message on the site.
 */
export async function ListingMessages({ children }: { children: ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ Hours: messages.Hours, Directions: messages.Directions }}>
      {children}
    </NextIntlClientProvider>
  );
}
