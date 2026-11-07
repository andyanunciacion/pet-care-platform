import { formatPesos } from '@paw/domain';
import type { useTranslations } from 'next-intl';
import type { PriceLabels } from './price-format';

/** The "Prices" messages, from useTranslations('Prices') or getTranslations('Prices'). */
type PricesTranslator = ReturnType<typeof useTranslations<'Prices'>>;

/** Units shown after the amount ("/night"); per visit is the default and goes unsaid. */
const SHOWN_UNITS = ['per_session', 'per_night', 'per_day'] as const;

const isShownUnit = (unit: string): unit is (typeof SHOWN_UNITS)[number] =>
  (SHOWN_UNITS as readonly string[]).includes(unit);

export interface AllPriceLabels extends PriceLabels {
  /** A product's price: "₱450", or "Ask for price" when there is none. */
  productPrice: (centavos: number | null) => string;
}

/** Builds the price labels from the translated strings (works on the server and in the browser). */
export function priceLabels(t: PricesTranslator): AllPriceLabels {
  return {
    amount: (amount) => t('amount', { amount }),
    range: (min, max) => t('range', { min, max }),
    from: (min) => t('from', { min }),
    callForPrice: t('callForPrice'),
    unit: (unit) => (isShownUnit(unit) ? t(`unitSuffix.${unit}`) : undefined),
    productPrice: (centavos) =>
      centavos === null ? t('askForPrice') : t('amount', { amount: formatPesos(centavos) }),
  };
}
