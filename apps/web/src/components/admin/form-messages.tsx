import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * Gives the admin form Client Components their strings (useTranslations), shipping only
 * the namespaces they use instead of every message on the site.
 */
export async function AdminFormMessages({ children }: { children: ReactNode }) {
  const { AdminForms, Enums } = await getMessages();
  return (
    <NextIntlClientProvider messages={{ AdminForms, Enums }}>{children}</NextIntlClientProvider>
  );
}
