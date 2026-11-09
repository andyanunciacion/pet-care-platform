// Turns the values in an audit_log diff ({ field: { from, to } }) into readable lines.
// The diff is stored as JSON, so values arrive untyped and are narrowed here.

import type { ServicePrice } from './price-format';

export interface AuditValueLabels {
  none: string;
  yes: string;
  no: string;
  /** For hours exceptions: "Closed". */
  closed: string;
  /** "phone" → "Phone"; undefined for unknown types (shown as-is). */
  contactType: (type: string) => string | undefined;
  /** ISO weekday (1 = Monday) → "Mon". */
  weekday: (dayOfWeek: number) => string;
  /** An ISO timestamp → a readable date and time. */
  dateTime: (iso: string) => string;
  /** An enum value's label for this field ("hidden" → "Hidden"), if it is one. */
  enumValue?: (value: string) => string | undefined;
  /** A service's price as owners see it (lib/price-format): "₱500–₱800", "Call for price". */
  servicePrice: (price: ServicePrice) => string;
  /** A product's price: "₱450", or "Ask for price" when there is none. */
  productPrice: (centavos: number | null) => string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function contactLine(item: Record<string, unknown>, labels: AuditValueLabels): string | undefined {
  if (typeof item.type !== 'string' || typeof item.value !== 'string') return undefined;
  const type = labels.contactType(item.type) ?? item.type;
  const label = typeof item.label === 'string' && item.label !== '' ? ` (${item.label})` : '';
  return `${type}: ${item.value}${label}`;
}

/** "08:00–12:00" for an { opensAt, closesAt } object. */
function intervalText(item: unknown): string | undefined {
  if (!isRecord(item) || typeof item.opensAt !== 'string' || typeof item.closesAt !== 'string') {
    return undefined;
  }
  return `${item.opensAt}–${item.closesAt}`;
}

/** A weekly hours row: "Mon 08:00–12:00". */
function weeklyLine(item: Record<string, unknown>, labels: AuditValueLabels): string | undefined {
  const interval = intervalText(item);
  if (typeof item.dayOfWeek !== 'number' || interval === undefined) return undefined;
  return `${labels.weekday(item.dayOfWeek)} ${interval}`;
}

/** An hours exception: "2026-12-25: Closed (Christmas)" or "2026-12-24: 09:00–12:00". */
function exceptionLine(value: Record<string, unknown>, labels: AuditValueLabels) {
  if (typeof value.date !== 'string' || typeof value.isClosed !== 'boolean') return undefined;
  const intervals = Array.isArray(value.intervals) ? value.intervals.map(intervalText) : [];
  const hours = value.isClosed ? labels.closed : intervals.filter(Boolean).join(', ');
  const note = typeof value.note === 'string' && value.note !== '' ? ` (${value.note})` : '';
  return `${value.date}: ${hours}${note}`;
}

const nullableNumber = (value: unknown): number | null | undefined =>
  value === null ? null : typeof value === 'number' ? value : undefined;

/**
 * A branch service (services/branch-services.ts in the API): "Spay / neuter: Kapon", then
 * the price (with its note), the species and the description, one per line.
 */
function serviceLines(value: Record<string, unknown>, labels: AuditValueLabels) {
  const { category, name, priceMin, priceMax, priceUnit, priceNote, species, description } = value;
  const min = nullableNumber(priceMin);
  const max = nullableNumber(priceMax);
  if (typeof name !== 'string' || typeof priceUnit !== 'string') return undefined;
  if (min === undefined || max === undefined || !Array.isArray(species)) return undefined;

  const note = typeof priceNote === 'string' && priceNote !== '' ? ` (${priceNote})` : '';
  const lines = [
    typeof category === 'string' ? `${category}: ${name}` : name,
    `${labels.servicePrice({ priceMin: min, priceMax: max, priceUnit })}${note}`,
  ];
  const speciesNames = species.filter((s): s is string => typeof s === 'string');
  if (speciesNames.length > 0) lines.push(speciesNames.join(', '));
  if (typeof description === 'string' && description !== '') lines.push(description);
  return lines;
}

/** A product: "Kibble 1 kg (Food)", then "₱450 · Available". */
/** An image: "Front of the clinic (1600×1200)", prefixed with its product for product images. */
function imageLine(value: Record<string, unknown>): string | undefined {
  const { alt, width, height, product } = value;
  if (typeof alt !== 'string' || typeof width !== 'number' || typeof height !== 'number') {
    return undefined;
  }
  const line = `${alt} (${String(width)}×${String(height)})`;
  return typeof product === 'string' ? `${product}: ${line}` : line;
}

function productLines(value: Record<string, unknown>, labels: AuditValueLabels) {
  const { name, category, price, availability } = value;
  const amount = nullableNumber(price);
  if (typeof name !== 'string' || typeof availability !== 'string' || amount === undefined) {
    return undefined;
  }
  const inCategory = typeof category === 'string' && category !== '' ? ` (${category})` : '';
  return [
    `${name}${inCategory}`,
    `${labels.productPrice(amount)} · ${labels.enumValue?.(availability) ?? availability}`,
  ];
}

function listItemLine(item: unknown, labels: AuditValueLabels): string {
  // Plain names, e.g. the species a branch treats.
  if (typeof item === 'string') return item;
  if (!isRecord(item)) return JSON.stringify(item);
  return contactLine(item, labels) ?? weeklyLine(item, labels) ?? JSON.stringify(item);
}

/** One line per value, or one per item for lists (contacts, weekly hours). */
export function auditValueLines(value: unknown, labels: AuditValueLabels): string[] {
  if (value === null || value === undefined || value === '') return [labels.none];
  if (typeof value === 'boolean') return [value ? labels.yes : labels.no];
  if (typeof value === 'string') {
    if (ISO_DATE_TIME.test(value)) return [labels.dateTime(value)];
    return [labels.enumValue?.(value) ?? value];
  }
  if (typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) {
    if (value.length === 0) return [labels.none];
    return value.map((item) => listItemLine(item, labels));
  }
  if (isRecord(value) && typeof value.lat === 'number' && typeof value.lng === 'number') {
    // Google Maps order, like the coordinates field in the branch form.
    return [`${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`];
  }
  if (isRecord(value)) {
    const line = exceptionLine(value, labels);
    if (line !== undefined) return [line];
    const lines = serviceLines(value, labels) ?? productLines(value, labels);
    if (lines !== undefined) return lines;
    const image = imageLine(value);
    if (image !== undefined) return [image];
  }
  return [JSON.stringify(value)];
}
