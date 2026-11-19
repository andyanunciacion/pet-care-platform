import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/** The few clinic-page strings a result card shares with it (species, Call, emergencies). */
const LISTING_KEYS = [
  'call',
  'treats',
  'treatsLabel',
  'emergencies',
  'emergenciesOpen',
  'emergenciesClosed',
  'emergenciesUnknown',
] as const;

/**
 * Gives the search pages' Client Components (search form, result cards) their strings,
 * shipping only those namespaces instead of every message on the site.
 */
export async function SearchMessages({ children }: { children: ReactNode }) {
  const messages = await getMessages();
  const listing = Object.fromEntries(LISTING_KEYS.map((key) => [key, messages.Listing[key]]));
  return (
    <NextIntlClientProvider
      messages={{
        Search: messages.Search,
        Hours: messages.Hours,
        Prices: messages.Prices,
        Listing: listing,
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
