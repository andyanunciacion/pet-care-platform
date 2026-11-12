// Public URLs of a business and its branches (ARCHITECTURE §8, D42). Separate from
// listings.ts so the admin's business service can use it without an import cycle.
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { branchPath, businessPath } from '@paw/domain';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, eq, ne } from 'drizzle-orm';

const { branch, psgcArea } = schema;

export interface PublicBranchPlace {
  id: string;
  slug: string;
  provinceSlug: string;
  citySlug: string;
}

/** A slug the database guarantees for provinces and cities (psgc_area_slug_by_level). */
function areaSlugOf(slug: string | null, code: string): string {
  if (slug === null) throw new Error(`PSGC area ${code} has no slug`);
  return slug;
}

/**
 * The branches shown publicly (all but hidden ones), in public order: the order they were
 * added. The first one places the business's own URL.
 */
export async function publicBranchPlaces(
  db: Pick<Db, 'select'>,
  businessId: string,
): Promise<PublicBranchPlace[]> {
  const province = alias(psgcArea, 'province');
  const city = alias(psgcArea, 'city');
  const rows = await db
    .select({
      id: branch.id,
      slug: branch.slug,
      provinceCode: province.code,
      provinceSlug: province.slug,
      cityCode: city.code,
      citySlug: city.slug,
    })
    .from(branch)
    .innerJoin(province, eq(province.code, branch.provinceCode))
    .innerJoin(city, eq(city.code, branch.cityCode))
    .where(and(eq(branch.businessId, businessId), ne(branch.listingStatus, 'hidden')))
    .orderBy(asc(branch.createdAt), asc(branch.id));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    provinceSlug: areaSlugOf(row.provinceSlug, row.provinceCode),
    citySlug: areaSlugOf(row.citySlug, row.cityCode),
  }));
}

export interface ListingPaths {
  business: string;
  /** By branch id. */
  branches: Map<string, string>;
}

/** The paths, or null when no branch is public (then there's no page to link to). */
export function listingPaths(
  businessSlug: string,
  places: readonly PublicBranchPlace[],
): ListingPaths | null {
  const [first] = places;
  if (first === undefined) return null;
  return {
    business: businessPath(businessSlug, first),
    branches: new Map(
      places.map((place) => [place.id, branchPath(businessSlug, place, places.length)]),
    ),
  };
}
