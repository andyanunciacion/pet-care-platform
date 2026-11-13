import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { configEnv } from './src/lib/env';
import { photosImageConfig } from './src/lib/photos';
import { apiRewrites } from './src/lib/rewrites';

const env = configEnv();

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next.js compiles them with the app.
  transpilePackages: ['@paw/api-client', '@paw/domain'],
  // Read when the server starts (and at build time), so API_URL must be set for builds too.
  rewrites: () => Promise.resolve(apiRewrites(env.API_URL)),
  // Public photos come from the bucket at PHOTOS_URL, read at build time (ARCHITECTURE D43).
  images: photosImageConfig(env.PHOTOS_URL),
};

// Wires up the i18n layer (src/i18n/request.ts) for Server Components.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
