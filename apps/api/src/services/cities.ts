// The cities owners can search in (the city picker when location is off, DESIGN UX1).
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { and, asc, eq, exists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

const { branch, business, psgcArea } = schema;

/** Angeles City: the launch city, searched when the owner hasn't picked one. */
export const DEFAULT_CITY_CODE = '0330100000';

const AreaSchema = z.object({ code: z.string(), name: z.string(), slug: z.string() });

export const CitiesSchema = z.object({
  /** Cities and municipalities with at least one published branch, by name. */
  cities: z.array(AreaSchema.extend({ province: AreaSchema })),
  /** The city to search when the owner hasn't picked one (it may not be in `cities` yet). */
  defaultCode: z.string(),
});

export type Cities = z.infer<typeof CitiesSchema>;

export async function listCities(db: Db): Promise<Cities> {
  const province = alias(psgcArea, 'province');
  const rows = await db
    .select({
      code: psgcArea.code,
      name: psgcArea.name,
      slug: psgcArea.slug,
      provinceCode: province.code,
      provinceName: province.name,
      provinceSlug: province.slug,
    })
    .from(psgcArea)
    .innerJoin(province, eq(province.code, psgcArea.parentCode))
    .where(
      // Same visibility as search: the business and the branch are both published.
      exists(
        db
          .select({ id: branch.id })
          .from(branch)
          .innerJoin(business, eq(business.id, branch.businessId))
          .where(
            and(
              eq(branch.cityCode, psgcArea.code),
              eq(branch.listingStatus, 'published'),
              eq(business.listingStatus, 'published'),
            ),
          ),
      ),
    )
    .orderBy(asc(psgcArea.name));

  return {
    cities: rows.flatMap((row) =>
      // Cities and provinces always have a slug (psgc_area_slug_by_level); this narrows the type.
      row.slug === null || row.provinceSlug === null
        ? []
        : [
            {
              code: row.code,
              name: row.name,
              slug: row.slug,
              province: { code: row.provinceCode, name: row.provinceName, slug: row.provinceSlug },
            },
          ],
    ),
    defaultCode: DEFAULT_CITY_CODE,
  };
}
