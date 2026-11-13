import { describe, expect, it } from 'vitest';
import { allowedPhoto, photosImageConfig } from './photos';

describe('photosImageConfig', () => {
  it('allows only the bucket URL', () => {
    expect(photosImageConfig('https://photos.example.test')).toEqual({
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'photos.example.test',
          port: '',
          pathname: '/**',
          search: '',
        },
      ],
    });
  });

  it('keeps a path prefix and a port', () => {
    expect(photosImageConfig('http://127.0.0.1:4100/bucket')).toEqual({
      remotePatterns: [
        {
          protocol: 'http',
          hostname: '127.0.0.1',
          port: '4100',
          pathname: '/bucket/**',
          search: '',
        },
      ],
      dangerouslyAllowLocalIP: true,
    });
  });

  it('allows no remote images without PHOTOS_URL', () => {
    expect(photosImageConfig(undefined)).toEqual({ remotePatterns: [] });
  });
});

describe('allowedPhoto', () => {
  const photo = { url: 'https://photos.example.test/photos/a.webp', alt: 'Front' };

  it('keeps an image under PHOTOS_URL', () => {
    expect(allowedPhoto(photo, 'https://photos.example.test')).toBe(photo);
  });

  it('drops an image from anywhere else, or when PHOTOS_URL is unset', () => {
    expect(allowedPhoto(photo, 'https://photos.example')).toBeNull();
    expect(allowedPhoto(photo, 'https://other.test')).toBeNull();
    expect(allowedPhoto(photo, undefined)).toBeNull();
    expect(allowedPhoto(null, 'https://photos.example.test')).toBeNull();
  });
});
