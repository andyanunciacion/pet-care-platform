import type { paths } from '@paw/api-client';

// Shapes of the public API, typed from its OpenAPI spec (D20), like admin-types.ts.

type Ok<T> = T extends { responses: { 200: { content: { 'application/json': infer Body } } } }
  ? Body
  : never;

export type Listing = Ok<paths['/v1/listings/{businessSlug}']['get']>;
export type ListingBusiness = Listing['business'];
export type ListingBranch = Listing['branches'][number];
export type ListingContact = ListingBranch['contacts'][number];
export type ListingService = ListingBranch['services'][number];
