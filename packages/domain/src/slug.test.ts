import { describe, expect, it } from 'vitest';
import { SLUG_PATTERN, slugify } from './slug.ts';

describe('slugify', () => {
  it.each([
    ['PAW Vet Clinic', 'paw-vet-clinic'],
    ["Dr. Cruz's Animal Clinic", 'dr-cruzs-animal-clinic'],
    ['Peña Pet Care', 'pena-pet-care'],
    ['  Cats & Dogs -- Angeles  ', 'cats-dogs-angeles'],
    ['Clinic #2 (Balibago)', 'clinic-2-balibago'],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
    expect(slug).toMatch(new RegExp(SLUG_PATTERN));
  });

  it('returns "" when there is nothing to keep', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(79)} b`);
    expect(slug).toBe('a'.repeat(79));
    expect(slug).toMatch(new RegExp(SLUG_PATTERN));
  });
});
