import { z } from 'zod';

const ServerEnvSchema = z.object({
  // Where Server Components reach the API (server to server; never sent to the browser).
  API_URL: z.url(),
});

export type ServerEnv = z.output<typeof ServerEnvSchema>;

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
