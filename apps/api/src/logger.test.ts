import { describe, expect, it } from 'vitest';
import { serializeRequest } from './logger.ts';

describe('serializeRequest', () => {
  it('logs only the method and path, never the query string', () => {
    expect(
      serializeRequest({ method: 'GET', url: '/v1/search?q=kapon&phone=09171234567' }),
    ).toEqual({ method: 'GET', path: '/v1/search' });
  });
});
