import { describe, expect, it } from 'vitest';
import { createR2Storage } from './storage.ts';

// Presigning is local computation (no network), so the real R2 client can be checked here.
describe('createR2Storage', () => {
  const storage = createR2Storage({
    accountId: 'test-account',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    bucket: 'paw-photos-test',
    publicUrl: 'https://pub-example.r2.dev',
  });

  it('presigns a PUT to the bucket that signs the type and size and expires in 10 minutes', async () => {
    const url = new URL(await storage.presignPut('tmp/abc.webp', 'image/webp', 1234));

    expect(url.origin).toBe('https://test-account.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/paw-photos-test/tmp/abc.webp');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(
      expect.arrayContaining(['content-length', 'content-type', 'host']),
    );
    // No checksum: a browser upload can't send one.
    expect([...url.searchParams.keys()].some((key) => key.includes('checksum'))).toBe(false);
  });

  it('builds public URLs from the public bucket URL', () => {
    expect(storage.publicUrl('branches/1/a.webp')).toBe(
      'https://pub-example.r2.dev/branches/1/a.webp',
    );
  });
});
