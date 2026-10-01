CREATE TYPE "public"."business_type" AS ENUM('vet_clinic');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('unclaimed', 'pending', 'verified');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('phone', 'messenger', 'viber', 'email');--> statement-breakpoint
CREATE TYPE "public"."hours_confirmed_by" AS ENUM('clinic', 'paw_ops', 'report');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('published', 'hidden', 'permanently_closed');--> statement-breakpoint
CREATE TYPE "public"."psgc_level" AS ENUM('province', 'city', 'municipality', 'barangay');--> statement-breakpoint
CREATE TABLE "psgc_area" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" "psgc_level" NOT NULL,
	"parent_code" text,
	CONSTRAINT "psgc_area_code_format" CHECK ("psgc_area"."code" ~ '^[0-9]{10}$')
);
--> statement-breakpoint
CREATE TABLE "business" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "business_type" NOT NULL,
	"description" text,
	"claim_status" "claim_status" DEFAULT 'unclaimed' NOT NULL,
	"listing_status" "listing_status" DEFAULT 'hidden' NOT NULL,
	"data_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_slug_unique" UNIQUE("slug"),
	CONSTRAINT "business_slug_format" CHECK ("business"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address_line" text NOT NULL,
	"province_code" text NOT NULL,
	"city_code" text NOT NULL,
	"barangay_code" text,
	"location" geography(Point, 4326) NOT NULL, -- hand-edited: drizzle-kit quotes custom types, which Postgres would read as a type name
	"is_24h" boolean DEFAULT false NOT NULL,
	"accepts_emergencies" boolean DEFAULT false NOT NULL,
	"listing_status" "listing_status" DEFAULT 'published' NOT NULL,
	"hours_confirmed_at" timestamp with time zone,
	"hours_confirmed_by" "hours_confirmed_by",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_businessId_slug_unique" UNIQUE("business_id","slug"),
	CONSTRAINT "branch_slug_format" CHECK ("branch"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "branch_hours_confirmed_pair" CHECK (("branch"."hours_confirmed_at" is null) = ("branch"."hours_confirmed_by" is null))
);
--> statement-breakpoint
CREATE TABLE "branch_contact" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"branch_id" uuid NOT NULL,
	"type" "contact_type" NOT NULL,
	"value" text NOT NULL,
	"label" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_contact_phone_e164" CHECK ("branch_contact"."type" not in ('phone', 'viber') or "branch_contact"."value" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "branch_hours" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"branch_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_hours_day_of_week" CHECK ("branch_hours"."day_of_week" between 1 and 7),
	CONSTRAINT "branch_hours_not_empty" CHECK ("branch_hours"."opens_at" <> "branch_hours"."closes_at")
);
--> statement-breakpoint
CREATE TABLE "branch_hours_exception" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"branch_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_closed" boolean NOT NULL,
	"intervals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_hours_exception_branchId_date_unique" UNIQUE("branch_id","date"),
	CONSTRAINT "branch_hours_exception_intervals_array" CHECK (jsonb_typeof("branch_hours_exception"."intervals") = 'array'),
	CONSTRAINT "branch_hours_exception_closed_or_open" CHECK ("branch_hours_exception"."is_closed" = ("branch_hours_exception"."intervals" = '[]'::jsonb))
);
--> statement-breakpoint
ALTER TABLE "psgc_area" ADD CONSTRAINT "psgc_area_parent_code_psgc_area_code_fk" FOREIGN KEY ("parent_code") REFERENCES "public"."psgc_area"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_province_code_psgc_area_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."psgc_area"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_city_code_psgc_area_code_fk" FOREIGN KEY ("city_code") REFERENCES "public"."psgc_area"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_barangay_code_psgc_area_code_fk" FOREIGN KEY ("barangay_code") REFERENCES "public"."psgc_area"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_contact" ADD CONSTRAINT "branch_contact_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_hours" ADD CONSTRAINT "branch_hours_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_hours_exception" ADD CONSTRAINT "branch_hours_exception_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "psgc_area_parent_code_index" ON "psgc_area" USING btree ("parent_code");--> statement-breakpoint
CREATE INDEX "branch_business_id_index" ON "branch" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "branch_city_code_index" ON "branch" USING btree ("city_code");--> statement-breakpoint
CREATE INDEX "branch_location_index" ON "branch" USING gist ("location");--> statement-breakpoint
CREATE INDEX "branch_contact_branch_id_index" ON "branch_contact" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_hours_branch_id_index" ON "branch_hours" USING btree ("branch_id");