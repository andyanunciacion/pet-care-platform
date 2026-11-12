import { describe, expect, it } from 'vitest';
import { areaSlug } from './area-slug.ts';
import { SLUG_PATTERN } from './slug.ts';

describe('areaSlug', () => {
  it.each([
    ['City of Angeles', 'city', 'angeles-city'],
    ['City of San Fernando', 'city', 'san-fernando-city'],
    ['Mabalacat City', 'city', 'mabalacat-city'],
    ['Science City of Muñoz', 'city', 'munoz-city'],
    ['City of San Jose del Monte', 'city', 'san-jose-del-monte-city'],
    ['Porac', 'municipality', 'porac'],
    ['Sto. Tomas', 'municipality', 'sto-tomas'],
    ['Sasmuan (Sexmoan)', 'municipality', 'sasmuan'],
    ['Peñaranda', 'municipality', 'penaranda'],
    ['Pampanga', 'province', 'pampanga'],
    ['Nueva Ecija', 'province', 'nueva-ecija'],
  ] as const)('%s (%s) → %s', (name, level, slug) => {
    expect(areaSlug(name, level)).toBe(slug);
    expect(slug).toMatch(new RegExp(SLUG_PATTERN));
  });
});
