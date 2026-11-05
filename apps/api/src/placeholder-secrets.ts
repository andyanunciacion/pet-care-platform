/**
 * Stand-ins for the required secrets wherever the app is built without real ones: tests
 * and OpenAPI generation. Nothing is ever signed for real or sent to Google with them.
 */
export const placeholderSecrets = {
  BETTER_AUTH_SECRET: 'placeholder-secret-at-least-32-characters',
  GOOGLE_CLIENT_ID: 'placeholder-google-client-id',
  GOOGLE_CLIENT_SECRET: 'placeholder-google-client-secret',
} as const;
