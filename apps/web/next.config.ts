import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { serverEnv } from './src/lib/env';
import { apiRewrites } from './src/lib/rewrites';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next.js compiles them with the app.
  transpilePackages: ['@paw/api-client', '@paw/domain'],
  // Read when the server starts (and at build time), so API_URL must be set for builds too.
  rewrites: () => Promise.resolve(apiRewrites(serverEnv().API_URL)),
};

// Wires up the i18n layer (src/i18n/request.ts) for Server Components.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
