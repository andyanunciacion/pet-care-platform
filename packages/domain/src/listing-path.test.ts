import { describe, expect, it } from 'vitest';
import { branchPath, businessPath } from './listing-path.ts';

const angeles = { provinceSlug: 'pampanga', citySlug: 'angeles-city' };
const mabalacat = { provinceSlug: 'pampanga', citySlug: 'mabalacat-city' };

describe('listing paths', () => {
  it('puts the business in the place of its first branch', () => {
    expect(businessPath('happy-paws', angeles)).toBe('/pampanga/angeles-city/happy-paws');
  });

  it('gives the only branch its business URL', () => {
    expect(branchPath('happy-paws', { ...angeles, slug: 'main' }, 1)).toBe(
      '/pampanga/angeles-city/happy-paws',
    );
  });

  it('gives each of several branches its own URL, in its own city', () => {
    expect(branchPath('pet-care-plus', { ...angeles, slug: 'balibago' }, 2)).toBe(
      '/pampanga/angeles-city/pet-care-plus/balibago',
    );
    expect(branchPath('pet-care-plus', { ...mabalacat, slug: 'dau' }, 2)).toBe(
      '/pampanga/mabalacat-city/pet-care-plus/dau',
    );
  });
});
