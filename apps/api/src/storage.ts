// Photo storage (ARCHITECTURE D38): a Cloudflare R2 bucket, spoken to through its
// S3-compatible API with the official AWS SDK. The app gets a `PhotoStorage`, so tests swap
// in the in-memory one below and never touch the network.
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { R2Config } from './env.ts';

/** How long a presigned upload URL works. */
export const UPLOAD_URL_TTL_SECONDS = 600;

/**
 * Final objects never change (a replaced photo gets a new key), so browsers and Cloudflare's
 * cache can keep them for a year.
 */
const IMMUTABLE = 'public, max-age=31536000, immutable';

export interface StoredObject {
  contentType: string;
  contentLength: number;
}

export interface PhotoStorage {
  /**
   * A URL the browser can PUT exactly this file to. The content type and length are signed,
   * so the upload can't swap them for something else.
   */
  presignPut(key: string, contentType: string, contentLength: number): Promise<string>;
  /** The object's type and size, or null if it doesn't exist. */
  head(key: string): Promise<StoredObject | null>;
  /** Copies an object to a new key, marking the copy cacheable for a year. */
  copy(from: string, to: string, contentType: string): Promise<void>;
  /** Deletes an object (no error if it's already gone). */
  delete(key: string): Promise<void>;
  /** Where the public can load the object. */
  publicUrl(key: string): string;
}

export function createR2Storage(config: R2Config): PhotoStorage {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    // <account>.r2.cloudflarestorage.com/<bucket>/<key>: the URL form R2 always serves.
    forcePathStyle: true,
    // The SDK adds checksums to uploads by default; a browser PUT through a presigned URL
    // can't send one, so only add them where S3 requires it (Cloudflare's R2 docs say so too).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = config.bucket;

  return {
    presignPut: (key, contentType, contentLength) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: contentLength,
        }),
        {
          expiresIn: UPLOAD_URL_TTL_SECONDS,
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      ),

    async head(key) {
      try {
        const object = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return {
          contentType: object.ContentType ?? '',
          contentLength: object.ContentLength ?? 0,
        };
      } catch (error) {
        if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
          return null;
        }
        throw error;
      }
    },

    async copy(from, to, contentType) {
      await client.send(
        new CopyObjectCommand({
          Bucket,
          Key: to,
          CopySource: `${Bucket}/${from}`,
          MetadataDirective: 'REPLACE',
          ContentType: contentType,
          CacheControl: IMMUTABLE,
        }),
      );
    },

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    publicUrl: (key) => `${config.publicUrl}/${key}`,
  };
}

/** An in-memory bucket for tests. `put` plays the browser's upload to a presigned URL. */
export interface MemoryStorage extends PhotoStorage {
  put(key: string, contentType: string, contentLength: number): void;
  has(key: string): boolean;
  keys(): string[];
}

export function createMemoryStorage(): MemoryStorage {
  const objects = new Map<string, StoredObject>();
  return {
    presignPut: (key, contentType, contentLength) =>
      Promise.resolve(
        `https://storage.test/${key}?type=${encodeURIComponent(contentType)}&length=${String(contentLength)}`,
      ),
    head: (key) => Promise.resolve(objects.get(key) ?? null),
    copy(from, to, contentType) {
      const object = objects.get(from);
      if (object === undefined) return Promise.reject(new Error(`no object ${from}`));
      objects.set(to, { ...object, contentType });
      return Promise.resolve();
    },
    delete(key) {
      objects.delete(key);
      return Promise.resolve();
    },
    publicUrl: (key) => `https://photos.test/${key}`,
    put(key, contentType, contentLength) {
      objects.set(key, { contentType, contentLength });
    },
    has: (key) => objects.has(key),
    keys: () => [...objects.keys()].sort(),
  };
}
