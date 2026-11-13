import { jsonLdScript } from '@/lib/json-ld';

/** Structured data for search engines (ARCHITECTURE §8), built in `lib/json-ld.ts`. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Escaped by jsonLdScript: no "<" can end the tag early.
      dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
    />
  );
}
