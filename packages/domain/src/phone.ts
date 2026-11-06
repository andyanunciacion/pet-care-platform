// Philippine numbers, as clinics write them: "0917 123 4567", "(045) 888 1234",
// "+63 917-123-4567". Stored as E.164 ("+639171234567"; CLAUDE.md).

/** A Philippine national number without the leading 0: mobile (9XX…) or landline. */
const MOBILE = /^9\d{9}$/;
// Landlines are 9 digits after the 0: Metro Manila "2" + 8 digits, elsewhere a 2-digit
// area code + 7 digits (e.g. Pampanga "45").
const LANDLINE = /^[2-8]\d{8}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalizes a phone number to E.164, or returns null if it isn't a valid number.
 * Philippine formats are checked strictly; numbers from other countries only need to look
 * like E.164 (they start with "+" and their country code).
 */
export function normalizePhPhone(input: string): string | null {
  const trimmed = input.trim();
  const plus = trimmed.startsWith('+');
  // Separators people type: spaces, dashes, dots, parentheses.
  const rest = (plus ? trimmed.slice(1) : trimmed).replace(/[\s\-.()]/g, '');
  if (!/^\d+$/.test(rest)) return null;

  let national: string;
  if (plus || (rest.startsWith('63') && rest.length >= 11)) {
    if (!rest.startsWith('63')) return E164.test(`+${rest}`) ? `+${rest}` : null;
    national = rest.slice(2);
  } else if (rest.startsWith('0')) {
    national = rest.slice(1);
  } else {
    // "9171234567": a mobile number without its leading 0.
    national = rest;
  }

  return MOBILE.test(national) || LANDLINE.test(national) ? `+63${national}` : null;
}
