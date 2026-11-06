import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

type Namespace = keyof Awaited<ReturnType<typeof getMessages>>;

/**
 * Gives the admin form Client Components their strings (useTranslations), shipping only
 * the namespaces they use instead of every message on the site. AdminForms and Enums are
 * always included; pass `extra` for forms that need more (the hours editor).
 */
export async function AdminFormMessages({
  children,
  extra = [],
}: {
  children: ReactNode;
  extra?: readonly Namespace[];
}) {
  const messages = await getMessages();
  const picked = Object.fromEntries(
    (['AdminForms', 'Enums', ...extra] as const).map((namespace) => [
      namespace,
      messages[namespace],
    ]),
  );
  return <NextIntlClientProvider messages={picked}>{children}</NextIntlClientProvider>;
}
