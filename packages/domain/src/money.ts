// Money is stored as integer centavos (CLAUDE.md), but people type and read pesos:
// "1,500", "₱1500.50", "800". Integer centavos avoid floating-point rounding errors
// (0.1 + 0.2 !== 0.3), which is why the conversion is done on the digits, not with *100.

/** The largest price accepted anywhere: ₱1,000,000. Anything above is almost always a typo. */
export const MAX_PRICE_CENTAVOS = 100_000_000;

const PESOS = /^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;

/**
 * Pesos as typed ("1,500", "₱1500.50", " 800 ") → centavos, or null when the text is empty.
 * Returns undefined when the text isn't an amount (letters, negative numbers, three
 * decimals), so the form can tell "no price" from "a price it can't read".
 */
export function parsePesos(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/^(₱|php|p)\s*/i, '');
  if (trimmed === '') return text.trim() === '' ? null : undefined;
  if (!PESOS.test(trimmed)) return undefined;

  const [whole = '0', fraction = ''] = trimmed.replaceAll(',', '').split('.');
  const centavos = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : undefined;
}

/** Centavos → pesos as people write them: 150000 → "1,500", 150050 → "1,500.50". */
export function formatPesos(centavos: number): string {
  const whole = Math.trunc(centavos / 100);
  const fraction = centavos % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, '0')}`;
}
