CREATE TABLE "search_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"query" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"area" text,
	"result_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "species" ADD COLUMN "synonyms" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "search_log_created_at_index" ON "search_log" USING btree ("created_at");--> statement-breakpoint
-- Species synonyms (hand-written): the Filipino and everyday words owners search with, plus
-- plurals (search doesn't stem these reliably). Lowercase, like the category synonyms.
UPDATE "species" SET "synonyms" = v.synonyms
FROM (VALUES
  ('dog', ARRAY['aso', 'tuta', 'dogs', 'puppy', 'puppies']),
  ('cat', ARRAY['pusa', 'kuting', 'cats', 'kitten', 'kittens']),
  ('rabbit', ARRAY['kuneho', 'bunny', 'rabbits']),
  ('small_mammal', ARRAY['hamster', 'guinea pig', 'rat', 'mouse']),
  ('bird', ARRAY['ibon', 'birds', 'parrot', 'lovebird']),
  ('reptile', ARRAY['ahas', 'pagong', 'snake', 'turtle', 'lizard', 'iguana']),
  ('fish', ARRAY['isda', 'koi']),
  ('poultry', ARRAY['manok', 'chicken', 'manok panabong']),
  ('livestock', ARRAY['baboy', 'kambing', 'baka', 'kalabaw', 'pig', 'goat', 'cow', 'carabao'])
) AS v (code, synonyms)
WHERE "species"."code" = v.code;
