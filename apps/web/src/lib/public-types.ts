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
export type ListingImage = ListingBranch['photos'][number];
export type ListingProduct = ListingBusiness['products'][number];

export type SearchResponse = Ok<paths['/v1/search']['get']>;
export type SearchResult = SearchResponse['results'][number];
export type SearchBranch = SearchResult['branch'];
/** What GET /v1/search takes (the API's names and types). */
export type SearchApiQuery = NonNullable<paths['/v1/search']['get']['parameters']['query']>;
export type Taxonomy = Ok<paths['/v1/taxonomy']['get']>;
export type Cities = Ok<paths['/v1/cities']['get']>;
export type City = Cities['cities'][number];
