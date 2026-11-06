import type { Db } from '@paw/db';
import { schema } from '@paw/db';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';

const { psgcArea } = schema;

export const ListAreasQuerySchema = z.object({
  /** The province (→ its cities and municipalities) or city (→ its barangays). Omit for provinces. */
  parentCode: z
    .string()
    .regex(/^[0-9]{10}$/)
    .optional(),
});

export const AreaListSchema = z.array(
  z.object({ code: z.string(), name: z.string(), level: z.enum(schema.psgcLevel.enumValues) }),
);

/** One level of the PSGC tree, for the address pickers. */
export async function listAreas(
  db: Db,
  { parentCode }: z.infer<typeof ListAreasQuerySchema>,
): Promise<z.infer<typeof AreaListSchema>> {
  return db
    .select({ code: psgcArea.code, name: psgcArea.name, level: psgcArea.level })
    .from(psgcArea)
    .where(
      parentCode === undefined
        ? eq(psgcArea.level, 'province')
        : eq(psgcArea.parentCode, parentCode),
    )
    .orderBy(asc(psgcArea.name));
}
