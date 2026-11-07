// Species and service categories (reference data, ARCHITECTURE D27), for the service editor.
import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { asc } from 'drizzle-orm';
import { z } from 'zod';

const { species, serviceCategory } = schema;

const TaxonomyItemSchema = z.object({ id: z.uuid(), code: z.string(), name: z.string() });

export const TaxonomySchema = z.object({
  species: z.array(TaxonomyItemSchema),
  /** Top-level groups; services use the categories nested under them (`children`). */
  categories: z.array(TaxonomyItemSchema.extend({ children: z.array(TaxonomyItemSchema) })),
});

export type Taxonomy = z.infer<typeof TaxonomySchema>;

export async function getTaxonomy(db: Db): Promise<Taxonomy> {
  const [speciesRows, categoryRows] = await Promise.all([
    db
      .select({ id: species.id, code: species.code, name: species.name })
      .from(species)
      .orderBy(asc(species.sortOrder), asc(species.name)),
    db
      .select({
        id: serviceCategory.id,
        code: serviceCategory.code,
        name: serviceCategory.name,
        parentId: serviceCategory.parentId,
      })
      .from(serviceCategory)
      .orderBy(asc(serviceCategory.sortOrder), asc(serviceCategory.name)),
  ]);

  const item = ({ id, code, name }: { id: string; code: string; name: string }) => ({
    id,
    code,
    name,
  });
  return {
    species: speciesRows,
    categories: categoryRows
      .filter((row) => row.parentId === null)
      .map((group) => ({
        ...item(group),
        children: categoryRows.filter((row) => row.parentId === group.id).map(item),
      })),
  };
}
