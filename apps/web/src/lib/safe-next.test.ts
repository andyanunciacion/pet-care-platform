import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it.each(['/admin', '/admin/listings?city=angeles', '/dashboard'])('keeps %s', (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ['another site', 'https://evil.example/admin'],
    ['a protocol-relative URL', '//evil.example'],
    ['a backslash trick', '/\\evil.example'],
    ['a relative path', 'admin'],
    ['javascript:', 'javascript:alert(1)'],
    ['a repeated param', ['/admin', '/x']],
    ['nothing', undefined],
  ])('falls back to /admin for %s', (_case, value) => {
    expect(safeNextPath(value)).toBe('/admin');
  });
});
