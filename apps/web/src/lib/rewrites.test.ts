import { describe, expect, it } from 'vitest';
import { apiRewrites } from './rewrites';

describe('apiRewrites', () => {
  it('proxies /v1/* to the API, path included', () => {
    expect(apiRewrites('https://api.example.test')).toEqual([
      { source: '/v1/:path*', destination: 'https://api.example.test/v1/:path*' },
    ]);
  });

  it('copes with a trailing slash on API_URL', () => {
    expect(apiRewrites('http://localhost:4000/')[0]?.destination).toBe(
      'http://localhost:4000/v1/:path*',
    );
  });
});
