import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.ts';

const DATABASE_URL = 'postgres://paw:secret-password@localhost:5432/paw';

describe('parseEnv', () => {
  it('fills in defaults', () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 4000,
      LOG_LEVEL: 'info',
      DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:3000'],
    });
  });

  it('coerces PORT and splits CORS_ORIGINS', () => {
    const env = parseEnv({
      DATABASE_URL,
      PORT: '8080',
      CORS_ORIGINS: 'https://paw.ph, https://staging.paw.ph',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['https://paw.ph', 'https://staging.paw.ph']);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres DATABASE_URL without echoing the value', () => {
    const attempt = () => parseEnv({ DATABASE_URL: 'mysql://paw:secret-password@localhost/paw' });
    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).not.toThrow(/secret-password/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ DATABASE_URL, PORT: '99999' })).toThrow(/PORT/);
  });
});
