import { formatPesos } from '@paw/domain';

// Service prices as owners read them (DESIGN UX10): "₱500–₱800", "From ₱500" or
// "Call for price", plus the unit when it isn't per visit ("₱800/night"). The strings come
// from the "Prices" messages; this file only decides which one applies.

export interface ServicePrice {
  /** Centavos. */
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string;
}

export interface PriceLabels {
  /** "₱{amount}" */
  amount: (amount: string) => string;
  /** "₱{min}–₱{max}" */
  range: (min: string, max: string) => string;
  /** "From ₱{min}" */
  from: (min: string) => string;
  callForPrice: string;
  /** "/night" for per_night; undefined when the unit isn't shown (per visit). */
  unit: (unit: string) => string | undefined;
}

export function servicePriceLabel(price: ServicePrice, labels: PriceLabels): string {
  if (price.priceMin === null) return labels.callForPrice;
  const min = formatPesos(price.priceMin);
  let main: string;
  if (price.priceMax === null) main = labels.from(min);
  else if (price.priceMax === price.priceMin) main = labels.amount(min);
  else main = labels.range(min, formatPesos(price.priceMax));
  return `${main}${labels.unit(price.priceUnit) ?? ''}`;
}
