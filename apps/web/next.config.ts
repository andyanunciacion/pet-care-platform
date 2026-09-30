import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next.js compiles them with the app.
  transpilePackages: ['@paw/api-client'],
};

// Wires up the i18n layer (src/i18n/request.ts) for Server Components.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
