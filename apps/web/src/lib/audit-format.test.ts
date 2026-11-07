import { describe, expect, it } from 'vitest';
import { auditValueLines, type AuditValueLabels } from './audit-format';

const labels: AuditValueLabels = {
  none: '—',
  yes: 'Yes',
  no: 'No',
  closed: 'Closed',
  contactType: (type) => ({ phone: 'Phone', viber: 'Viber' })[type],
  weekday: (day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day - 1] ?? String(day),
  dateTime: (iso) => `at ${iso.slice(0, 10)}`,
  enumValue: (value) => ({ hidden: 'Hidden', out: 'Out of stock' })[value],
  servicePrice: ({ priceMin, priceMax }) =>
    priceMin === null ? 'Call for price' : `${String(priceMin)}–${String(priceMax)}`,
  productPrice: (centavos) => (centavos === null ? 'Ask for price' : `₱${String(centavos)}`),
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

  it('lists weekly hours one interval per line', () => {
    expect(
      auditValueLines(
        [
          { dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
          { dayOfWeek: 6, opensAt: '20:00', closesAt: '02:00' },
        ],
        labels,
      ),
    ).toEqual(['Mon 08:00–12:00', 'Sat 20:00–02:00']);
  });

  it('shows an hours exception on one line', () => {
    expect(
      auditValueLines(
        { date: '2026-12-25', isClosed: true, intervals: [], note: 'Christmas' },
        labels,
      ),
    ).toEqual(['2026-12-25: Closed (Christmas)']);
    expect(
      auditValueLines(
        {
          date: '2026-12-24',
          isClosed: false,
          intervals: [
            { opensAt: '09:00', closesAt: '12:00' },
            { opensAt: '13:00', closesAt: '15:00' },
          ],
          note: null,
        },
        labels,
      ),
    ).toEqual(['2026-12-24: 09:00–12:00, 13:00–15:00']);
  });

  it('lists plain names one per line (species treated)', () => {
    expect(auditValueLines(['Dog', 'Cat'], labels)).toEqual(['Dog', 'Cat']);
  });

  it('shows a service as category: name, price (note), species and description', () => {
    const service = {
      category: 'Spay / neuter',
      name: 'Kapon',
      description: null,
      priceMin: 150_000,
      priceMax: 300_000,
      priceUnit: 'per_visit',
      priceNote: 'Depends on weight',
      species: ['Dog', 'Cat'],
    };
    expect(auditValueLines(service, labels)).toEqual([
      'Spay / neuter: Kapon',
      '150000–300000 (Depends on weight)',
      'Dog, Cat',
    ]);
    expect(
      auditValueLines(
        {
          ...service,
          priceMin: null,
          priceMax: null,
          priceNote: null,
          species: [],
          description: 'Includes meds',
        },
        labels,
      ),
    ).toEqual(['Spay / neuter: Kapon', 'Call for price', 'Includes meds']);
  });

  it('shows a product as name (category), then price · availability', () => {
    expect(
      auditValueLines(
        { name: 'Kibble', category: 'Food', price: 45_000, availability: 'out' },
        labels,
      ),
    ).toEqual(['Kibble (Food)', '₱45000 · Out of stock']);
    expect(
      auditValueLines(
        { name: 'Leash', category: null, price: null, availability: 'limited' },
        labels,
      ),
    ).toEqual(['Leash', 'Ask for price · limited']);
  });

  it('formats timestamps', () => {
    expect(auditValueLines('2026-11-06T04:30:00.000Z', labels)).toEqual(['at 2026-11-06']);
  });

  it('falls back to JSON for anything else', () => {
    expect(auditValueLines({ a: 1 }, labels)).toEqual(['{"a":1}']);
  });
});
