-- PostGIS: geography columns, radius filtering and distance ordering (ARCHITECTURE §6).
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
-- pg_trgm: trigram similarity for typo-tolerant search ("kapn" still finds "kapon").
CREATE EXTENSION IF NOT EXISTS pg_trgm;
