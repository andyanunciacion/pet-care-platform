import type messages from '../../messages/en.json';
import type { Locale } from './config';

// Makes translation keys type-checked: t('Home.title') compiles, t('Home.typo') doesn't.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
