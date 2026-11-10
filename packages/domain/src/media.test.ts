import { describe, expect, it } from 'vitest';
import { fitWithin } from './media.ts';

describe('fitWithin', () => {
  it('scales a landscape photo so its width is the max edge', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo so its height is the max edge', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('keeps an image that already fits (never scales up)', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('rounds, and never returns a zero side for very thin images', () => {
    expect(fitWithin(1000, 333, 512)).toEqual({ width: 512, height: 170 });
    expect(fitWithin(10_000, 1, 512)).toEqual({ width: 512, height: 1 });
  });
});
