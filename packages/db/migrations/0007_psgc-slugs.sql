ALTER TABLE "psgc_area" ADD COLUMN "slug" text;--> statement-breakpoint
-- Backfill (hand-written): Pampanga's slugs, generated once with areaSlug() from @paw/domain
-- (ARCHITECTURE D42). reference-data.test.ts checks every row still matches the function.
-- Provinces added later get their slugs from the psgc:sql script.
UPDATE "psgc_area" SET "slug" = v.slug
FROM (VALUES
  ('0305400000', 'pampanga'),
  ('0305402000', 'apalit'),
  ('0305403000', 'arayat'),
  ('0305404000', 'bacolor'),
  ('0305405000', 'candaba'),
  ('0305406000', 'floridablanca'),
  ('0305407000', 'guagua'),
  ('0305408000', 'lubao'),
  ('0305409000', 'mabalacat-city'),
  ('0305410000', 'macabebe'),
  ('0305411000', 'magalang'),
  ('0305412000', 'masantol'),
  ('0305413000', 'mexico'),
  ('0305414000', 'minalin'),
  ('0305415000', 'porac'),
  ('0305416000', 'san-fernando-city'),
  ('0305417000', 'san-luis'),
  ('0305418000', 'san-simon'),
  ('0305419000', 'santa-ana'),
  ('0305420000', 'santa-rita'),
  ('0305421000', 'sto-tomas'),
  ('0305422000', 'sasmuan'),
  ('0330100000', 'angeles-city')
) AS v(code, slug)
WHERE "psgc_area"."code" = v.code;--> statement-breakpoint
CREATE UNIQUE INDEX "psgc_area_slug_unique" ON "psgc_area" USING btree (coalesce("parent_code", ''),"slug") WHERE "psgc_area"."slug" is not null;--> statement-breakpoint
ALTER TABLE "psgc_area" ADD CONSTRAINT "psgc_area_slug_format" CHECK ("psgc_area"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "psgc_area" ADD CONSTRAINT "psgc_area_slug_by_level" CHECK (("psgc_area"."level" = 'barangay') = ("psgc_area"."slug" is null));
