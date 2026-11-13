import { z } from 'zod';

const ServerEnvSchema = z.object({
  // Where Server Components reach the API (server to server; never sent to the browser).
  API_URL: z.url(),
  // This site's public origin. Canonical URLs, Open Graph tags and JSON-LD are absolute
  // and start with it (ARCHITECTURE §8). Read at build time too.
  SITE_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
  // Where the photo bucket's objects are public: the API's R2_PUBLIC_URL. Optional: without
  // it public pages show no images (next/image only loads hosts listed in next.config.ts,
  // which reads this at build time; ARCHITECTURE D43).
  PHOTOS_URL: z
    .url({ protocol: /^https?$/ })
    .transform((url) => url.replace(/\/+$/, ''))
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type ServerEnv = z.output<typeof ServerEnvSchema>;

/**
 * The settings next.config.ts reads, without the rest: `next typegen` (the typecheck) loads
 * the config too, and shouldn't need SITE_URL for it.
 */
export function configEnv() {
  const result = ServerEnvSchema.pick({ API_URL: true, PHOTOS_URL: true }).safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/**
 * Server-side settings, validated on first use rather than at import, because
 * `next build` loads page modules in environments that don't have them.
 * The error names the variables but never echoes their values.
 */
export function serverEnv(): ServerEnv {
  if (cached === undefined) {
    const result = ServerEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
    }
    cached = result.data;
  }
  return cached;
}
