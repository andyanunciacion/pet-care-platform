import type { paths } from '@paw/api-client';

// Request and response shapes of the admin API, typed from its OpenAPI spec (D20), so a
// change to an API schema shows up as a type error in the forms that use it.

type JsonBody<T> = T extends { content: { 'application/json': infer Body } } ? Body : never;
type Ok<T> = T extends { responses: { 200: infer R } } | { responses: { 201: infer R } }
  ? JsonBody<R>
  : never;

export type CreateBusinessBody = JsonBody<paths['/v1/admin/businesses']['post']['requestBody']>;
export type UpdateBusinessBody = JsonBody<
  paths['/v1/admin/businesses/{id}']['patch']['requestBody']
>;
export type BusinessDetail = Ok<paths['/v1/admin/businesses/{id}']['get']>;

export type CreateBranchBody = JsonBody<
  paths['/v1/admin/businesses/{id}/branches']['post']['requestBody']
>;
export type UpdateBranchBody = JsonBody<paths['/v1/admin/branches/{id}']['patch']['requestBody']>;
export type Branch = Ok<paths['/v1/admin/branches/{id}']['get']>;
export type ContactInput = CreateBranchBody['contacts'] extends (infer C)[] | undefined ? C : never;

export type PsgcArea = Ok<paths['/v1/admin/psgc-areas']['get']>[number];
export type AuditLogPage = Ok<paths['/v1/admin/audit-log']['get']>;
export type AuditEntry = AuditLogPage['items'][number];

export type ListingStatus = BusinessDetail['listingStatus'];
export type ClaimStatus = BusinessDetail['claimStatus'];
export type ContactType = Branch['contacts'][number]['type'];

// The enum values, for building selects. `satisfies` makes the compiler check they match
// the API's enums (adding a value there without adding it here is a type error).
export const LISTING_STATUSES = [
  'published',
  'hidden',
  'permanently_closed',
] as const satisfies readonly ListingStatus[];
export const CLAIM_STATUSES = [
  'unclaimed',
  'pending',
  'verified',
] as const satisfies readonly ClaimStatus[];
export const CONTACT_TYPES = [
  'phone',
  'viber',
  'messenger',
  'email',
] as const satisfies readonly ContactType[];
