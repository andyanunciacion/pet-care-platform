import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { business } from './business.ts';
import { id, timestamps } from './columns.ts';
import { productAvailability } from './enums.ts';

/** A product a business sells, shown read-only (no cart, no stock counts). Photos are in media. */
export const product = pgTable(
  'product',
  {
    id: id(),
    businessId: uuid()
      .notNull()
      .references(() => business.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Free text for now, e.g. "Food", "Accessories". */
    category: text(),
    /** In centavos. Null shows "Ask for price". */
    price: integer(),
    availability: productAvailability().notNull().default('available'),
    ...timestamps,
  },
  (table) => [
    check('product_price_positive', sql`${table.price} >= 0`),
    index().on(table.businessId),
  ],
);
