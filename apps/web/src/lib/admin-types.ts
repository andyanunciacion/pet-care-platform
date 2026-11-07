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

export type BranchHours = Ok<paths['/v1/admin/branches/{id}/hours']['get']>;
export type ReplaceHoursBody = JsonBody<
  paths['/v1/admin/branches/{id}/hours']['put']['requestBody']
>;
export type SetHoursExceptionBody = JsonBody<
  paths['/v1/admin/branches/{id}/hours-exceptions/{date}']['put']['requestBody']
>;
export type HoursConfirmedBy = NonNullable<BranchHours['hoursConfirmedBy']>;

export type Taxonomy = Ok<paths['/v1/admin/taxonomy']['get']>;
export type BranchServices = Ok<paths['/v1/admin/branches/{id}/services']['get']>;
export type BranchService = BranchServices['services'][number];
export type CreateServiceBody = JsonBody<
  paths['/v1/admin/branches/{id}/services']['post']['requestBody']
>;
export type UpdateServiceBody = JsonBody<paths['/v1/admin/services/{id}']['patch']['requestBody']>;
export type CopyServiceResult = Ok<paths['/v1/admin/services/{id}/copy-to-branches']['post']>;
export type PriceUnit = BranchService['priceUnit'];

export type Product = Ok<paths['/v1/admin/businesses/{id}/products']['get']>[number];
export type CreateProductBody = JsonBody<
  paths['/v1/admin/businesses/{id}/products']['post']['requestBody']
>;
export type UpdateProductBody = JsonBody<paths['/v1/admin/products/{id}']['patch']['requestBody']>;
export type ProductAvailability = Product['availability'];

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
export const HOURS_CONFIRMED_BY = [
  'clinic',
  'paw_ops',
  'report',
] as const satisfies readonly HoursConfirmedBy[];
export const CONTACT_TYPES = [
  'phone',
  'viber',
  'messenger',
  'email',
] as const satisfies readonly ContactType[];
export const PRICE_UNITS = [
  'per_visit',
  'per_session',
  'per_night',
  'per_day',
] as const satisfies readonly PriceUnit[];
export const PRODUCT_AVAILABILITIES = [
  'available',
  'limited',
  'out',
] as const satisfies readonly ProductAvailability[];
