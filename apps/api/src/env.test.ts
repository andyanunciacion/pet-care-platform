import { describe, expect, it } from 'vitest';
import { parseEnv, r2Config } from './env.ts';

const DATABASE_URL = 'postgres://paw:secret-password@localhost:5432/paw';
// The variables without defaults.
const required = {
  DATABASE_URL,
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
};

describe('parseEnv', () => {
  it('fills in defaults', () => {
    expect(parseEnv(required)).toEqual({
      ...required,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 4000,
      LOG_LEVEL: 'info',
      TRUST_PROXY_HOPS: 0,
      CORS_ORIGINS: ['http://localhost:3000'],
      BETTER_AUTH_URL: 'http://localhost:3000',
    });
  });

  it('coerces PORT and splits CORS_ORIGINS', () => {
    const env = parseEnv({
      ...required,
      PORT: '8080',
      CORS_ORIGINS: 'https://paw.ph, https://staging.paw.ph',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['https://paw.ph', 'https://staging.paw.ph']);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({ ...required, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres DATABASE_URL without echoing the value', () => {
    const attempt = () =>
      parseEnv({ ...required, DATABASE_URL: 'mysql://paw:secret-password@localhost/paw' });
    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).not.toThrow(/secret-password/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => parseEnv({ ...required, PORT: '99999' })).toThrow(/PORT/);
  });

  it('rejects a short BETTER_AUTH_SECRET without echoing it', () => {
    const attempt = () => parseEnv({ ...required, BETTER_AUTH_SECRET: 'too-short-secret' });
    expect(attempt).toThrow(/BETTER_AUTH_SECRET/);
    expect(attempt).not.toThrow(/too-short-secret/);
  });

  it('requires the Google OAuth client', () => {
    expect(() => parseEnv({ ...required, GOOGLE_CLIENT_ID: undefined })).toThrow(
      /GOOGLE_CLIENT_ID/,
    );
  });
});

describe('R2 photo storage settings', () => {
  const r2 = {
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key-id',
    R2_SECRET_ACCESS_KEY: 'r2-secret-value',
    R2_BUCKET: 'paw-photos-dev',
    R2_PUBLIC_URL: 'https://pub-example.r2.dev/',
  };

  it('is off when none are set, or when they are empty (a copied .env.example)', () => {
    expect(r2Config(parseEnv(required))).toBeNull();
    const empty = Object.fromEntries(Object.keys(r2).map((name) => [name, '']));
    expect(r2Config(parseEnv({ ...required, ...empty }))).toBeNull();
  });

  it('is on when all are set, with the public URL trimmed of its trailing slash', () => {
    expect(r2Config(parseEnv({ ...required, ...r2 }))).toEqual({
      accountId: 'account-id',
      accessKeyId: 'access-key-id',
      secretAccessKey: 'r2-secret-value',
      bucket: 'paw-photos-dev',
      publicUrl: 'https://pub-example.r2.dev',
    });
  });

  it('names the missing ones when only some are set, without echoing the secret', () => {
    const attempt = () => parseEnv({ ...required, ...r2, R2_BUCKET: undefined });
    expect(attempt).toThrow(/R2_BUCKET/);
    expect(attempt).not.toThrow(/r2-secret-value/);
  });
});
