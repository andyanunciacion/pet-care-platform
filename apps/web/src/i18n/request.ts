import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, type Locale } from './config';

// Each locale's UI strings, loaded only when that locale is used.
const messages = {
  en: () => import('../../messages/en.json'),
} satisfies Record<Locale, () => Promise<unknown>>;

// Tells next-intl which locale and strings to use. English only for now (DESIGN.md UX15),
// with no locale in URLs, so adding Filipino later means adding a messages file and a
// way to pick the locale, not touching every page.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return { locale, messages: (await messages[locale]()).default };
});
