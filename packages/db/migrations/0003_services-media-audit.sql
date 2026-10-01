CREATE TYPE "public"."media_kind" AS ENUM('logo', 'photo');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('per_visit', 'per_session', 'per_night', 'per_day');--> statement-breakpoint
CREATE TYPE "public"."product_availability" AS ENUM('available', 'limited', 'out');--> statement-breakpoint
CREATE TABLE "service_category" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"synonyms" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_category_code_unique" UNIQUE("code"),
	CONSTRAINT "service_category_code_format" CHECK ("service_category"."code" ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
	CONSTRAINT "service_category_not_own_parent" CHECK ("service_category"."parent_id" <> "service_category"."id")
);
--> statement-breakpoint
CREATE TABLE "species" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "species_code_unique" UNIQUE("code"),
	CONSTRAINT "species_code_format" CHECK ("species"."code" ~ '^[a-z0-9]+(_[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "branch_service" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"branch_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_min" integer,
	"price_max" integer,
	"price_unit" "price_unit" DEFAULT 'per_visit' NOT NULL,
	"price_note" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_service_price_min_positive" CHECK ("branch_service"."price_min" >= 0),
	CONSTRAINT "branch_service_price_range" CHECK ("branch_service"."price_max" is null or ("branch_service"."price_min" is not null and "branch_service"."price_max" >= "branch_service"."price_min"))
);
--> statement-breakpoint
CREATE TABLE "branch_service_species" (
	"branch_service_id" uuid NOT NULL,
	"species_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_service_species_branch_service_id_species_id_pk" PRIMARY KEY("branch_service_id","species_id")
);
--> statement-breakpoint
CREATE TABLE "branch_species" (
	"branch_id" uuid NOT NULL,
	"species_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_species_branch_id_species_id_pk" PRIMARY KEY("branch_id","species_id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"price" integer,
	"availability" "product_availability" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_price_positive" CHECK ("product"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"kind" "media_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"business_id" uuid,
	"branch_id" uuid,
	"product_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storageKey_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_one_owner" CHECK (num_nonnulls("media"."business_id", "media"."branch_id", "media"."product_id") = 1),
	CONSTRAINT "media_alt_not_blank" CHECK (btrim("media"."alt") <> ''),
	CONSTRAINT "media_dimensions_positive" CHECK ("media"."width" > 0 and "media"."height" > 0),
	CONSTRAINT "media_logo_on_business" CHECK ("media"."kind" <> 'logo' or "media"."business_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_category" ADD CONSTRAINT "service_category_parent_id_service_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_service" ADD CONSTRAINT "branch_service_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_service" ADD CONSTRAINT "branch_service_category_id_service_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_service_species" ADD CONSTRAINT "branch_service_species_branch_service_id_branch_service_id_fk" FOREIGN KEY ("branch_service_id") REFERENCES "public"."branch_service"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_service_species" ADD CONSTRAINT "branch_service_species_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_species" ADD CONSTRAINT "branch_species_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_species" ADD CONSTRAINT "branch_species_species_id_species_id_fk" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_category_parent_id_index" ON "service_category" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "branch_service_branch_id_index" ON "branch_service" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_service_category_id_index" ON "branch_service" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "branch_service_species_species_id_index" ON "branch_service_species" USING btree ("species_id");--> statement-breakpoint
CREATE INDEX "branch_species_species_id_index" ON "branch_species" USING btree ("species_id");--> statement-breakpoint
CREATE INDEX "product_business_id_index" ON "product" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_one_logo_per_business" ON "media" USING btree ("business_id") WHERE "media"."kind" = 'logo';--> statement-breakpoint
CREATE INDEX "media_business_id_index" ON "media" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "media_branch_id_index" ON "media" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "media_product_id_index" ON "media" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_entity_id_created_at_index" ON "audit_log" USING btree ("entity_type","entity_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_index" ON "audit_log" USING btree ("actor_id");