// Turns the values in an audit_log diff ({ field: { from, to } }) into readable lines.
// The diff is stored as JSON, so values arrive untyped and are narrowed here.

export interface AuditValueLabels {
  none: string;
  yes: string;
  no: string;
  /** "phone" → "Phone"; undefined for unknown types (shown as-is). */
  contactType: (type: string) => string | undefined;
  /** An enum value's label for this field ("hidden" → "Hidden"), if it is one. */
  enumValue?: (value: string) => string | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function contactLine(item: unknown, labels: AuditValueLabels): string | undefined {
  if (!isRecord(item) || typeof item.type !== 'string' || typeof item.value !== 'string') {
    return undefined;
  }
  const type = labels.contactType(item.type) ?? item.type;
  const label = typeof item.label === 'string' && item.label !== '' ? ` (${item.label})` : '';
  return `${type}: ${item.value}${label}`;
}

/** One line per value, or one per contact for contact lists. */
export function auditValueLines(value: unknown, labels: AuditValueLabels): string[] {
  if (value === null || value === undefined || value === '') return [labels.none];
  if (typeof value === 'boolean') return [value ? labels.yes : labels.no];
  if (typeof value === 'string') return [labels.enumValue?.(value) ?? value];
  if (typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) {
    if (value.length === 0) return [labels.none];
    return value.map((item) => contactLine(item, labels) ?? JSON.stringify(item));
  }
  if (isRecord(value) && typeof value.lat === 'number' && typeof value.lng === 'number') {
    // Google Maps order, like the coordinates field in the branch form.
    return [`${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`];
  }
  return [JSON.stringify(value)];
}
