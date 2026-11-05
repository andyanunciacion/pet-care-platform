/**
 * Where to send the user after sign-in, from an untrusted `?next=` value. Only paths on
 * this site are allowed ("/admin/listings"); anything else falls back, so a crafted link
 * can't bounce someone to another site after they sign in (an "open redirect").
 */
export function safeNextPath(value: unknown, fallback = '/admin'): string {
  if (typeof value !== 'string') return fallback;
  // "//evil.example" and "/\evil.example" are protocol-relative URLs to another site.
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
