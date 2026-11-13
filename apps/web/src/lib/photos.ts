import type { NextConfig } from 'next';

// Public images (ARCHITECTURE D43): stored files live in the photo bucket, and next/image
// resizes them per screen through the host's image optimizer. next/image only loads hosts
// allowed in next.config.ts, so the bucket's public URL (PHOTOS_URL) is both the allowed
// pattern and the check that an image URL is one we can show.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** next.config.ts `images`: the bucket's URL as the only remote pattern, if there is one. */
export function photosImageConfig(photosUrl: string | undefined): NextConfig['images'] {
  if (photosUrl === undefined) return { remotePatterns: [] };
  const url = new URL(photosUrl);
  const path = url.pathname.replace(/\/+$/, '');
  return {
    remotePatterns: [
      {
        protocol: url.protocol === 'http:' ? 'http' : 'https',
        hostname: url.hostname,
        port: url.port,
        pathname: `${path}/**`,
        search: '',
      },
    ],
    // Next 16 won't optimize images from private addresses (a guard against SSRF: making the
    // server fetch internal URLs). Only a bucket on this machine needs it: the Lighthouse
    // fixture serves its photos locally (ARCHITECTURE D44).
    ...(LOCAL_HOSTS.has(url.hostname) && { dangerouslyAllowLocalIP: true }),
  };
}

/**
 * The image, if next/image may load it: its URL is under PHOTOS_URL. Otherwise null, so a
 * missing or mismatched PHOTOS_URL hides images instead of crashing the page (next/image
 * throws on a host that isn't allowed).
 */
export function allowedPhoto<T extends { url: string }>(
  image: T | null | undefined,
  photosUrl: string | undefined,
): T | null {
  if (image === null || image === undefined || photosUrl === undefined) return null;
  return image.url.startsWith(`${photosUrl}/`) ? image : null;
}
