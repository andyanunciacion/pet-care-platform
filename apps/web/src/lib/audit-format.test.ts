import { describe, expect, it } from 'vitest';
import { auditValueLines, type AuditValueLabels } from './audit-format';

const labels: AuditValueLabels = {
  none: '—',
  yes: 'Yes',
  no: 'No',
  contactType: (type) => ({ phone: 'Phone', viber: 'Viber' })[type],
  enumValue: (value) => ({ hidden: 'Hidden' })[value],
};

describe('auditValueLines', () => {
  it('shows empty values as a dash', () => {
    expect(auditValueLines(null, labels)).toEqual(['—']);
    expect(auditValueLines('', labels)).toEqual(['—']);
    expect(auditValueLines([], labels)).toEqual(['—']);
  });

  it('labels booleans and enum values', () => {
    expect(auditValueLines(true, labels)).toEqual(['Yes']);
    expect(auditValueLines('hidden', labels)).toEqual(['Hidden']);
    expect(auditValueLines('Balibago', labels)).toEqual(['Balibago']);
  });

  it('shows a map pin as "lat, lng"', () => {
    expect(auditValueLines({ lng: 120.5887, lat: 15.145 }, labels)).toEqual([
      '15.145000, 120.588700',
    ]);
  });

  it('lists contacts one per line', () => {
    expect(
      auditValueLines(
        [
          { type: 'phone', value: '+639171234567', label: 'Globe' },
          { type: 'viber', value: '+639177654321', label: null },
          { type: 'fax', value: '123', label: null },
        ],
        labels,
      ),
    ).toEqual(['Phone: +639171234567 (Globe)', 'Viber: +639177654321', 'fax: 123']);
  });

  it('falls back to JSON for anything else', () => {
    expect(auditValueLines({ a: 1 }, labels)).toEqual(['{"a":1}']);
  });
});
