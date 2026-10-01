# GitHub issues — reference list

> A one-time reference for creating issues. **Once they exist, GitHub is the source of truth.** This file can be deleted, or kept as templates.
> IDs like `P0-T1` are only for cross-referencing dependencies here. GitHub assigns the real numbers.
> Order follows [ROADMAP.md](ROADMAP.md). Branch naming: `<issue#>-<short-slug>`. Commits: `#<issue#> <title>`.

**Suggested labels:** `infra` · `backend` · `frontend` · `design` · `ops` (admin tooling) · `business` (non-code) · `blocked` (waiting on the validation checkpoint)
**Suggested milestones:** `Phase 0 — Groundwork` · `Phase 1 — Directory MVP`

---

## Phase 0 — Technical groundwork

### P0-T1 · Monorepo foundation
`infra` · Depends on: —
**Goal:** An empty but fully wired monorepo that every app and package builds on.
- [x] pnpm workspaces + Turborepo; Node 24 pinned (`.nvmrc`, `engines`, `packageManager`)
- [x] `packages/config`: shared strict tsconfig + ESLint (flat config) + Prettier
- [x] Vitest wired at the root (`pnpm test` runs all packages)
- [x] `.gitattributes` (LF line endings), `.editorconfig`, `.gitignore`, `.env.example`
- [x] `docker-compose.yml` with Postgres 16 + PostGIS
- [x] Root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`
- [x] "Commands" section added to `CLAUDE.md`

**Done when:** a fresh clone runs `pnpm install && pnpm lint && pnpm typecheck && pnpm test` cleanly, and `docker compose up` starts a database with PostGIS enabled.

### P0-T2 · API skeleton
`backend` · Depends on: P0-T1
**Goal:** A running Fastify API with the conventions every future route follows.
- [x] `apps/api` with Fastify + `fastify-type-provider-zod`
- [x] Env vars validated with Zod at startup (the app refuses to boot if they're invalid)
- [x] `GET /health` (API up + DB reachable)
- [x] Error format: RFC 9457 `problem+json`
- [x] pino logging (no personal data), helmet, CORS
- [x] OpenAPI generation (`@fastify/swagger`) + docs page in dev
- [x] Integration test for `/health`

**Done when:** `pnpm dev` serves `/health` and the OpenAPI docs locally, and the tests pass.

### P0-T3 · Database package
`backend` · Depends on: P0-T1
**Goal:** Drizzle set up so slice 1 can focus purely on the schema.
- [x] `packages/db`: Drizzle ORM + drizzle-kit, connection helper
- [x] First migration: enable `postgis` and `pg_trgm` extensions
- [x] Scripts: `db:generate`, `db:migrate`, `db:studio`
- [x] Test helper: fresh database per test run (real Postgres+PostGIS in Docker)
- [x] `/health` checks the DB through this package

**Done when:** migrations run against the local Docker DB, and an integration test can create and query a table.

### P0-T4 · Web skeleton + design tokens
`frontend` · Depends on: P0-T2
**Goal:** A Next.js app, themed with the placeholder brand, that talks to the API through a typed client.
- [x] `apps/web`: Next.js (App Router), Tailwind, shadcn/ui
- [x] Design tokens from DESIGN.md §7.1 as CSS variables (shadcn names + PAW status tokens)
- [x] System font stack, `PawPrint` wordmark placeholder, favicon
- [x] i18n layer for UI strings (English only for now; DESIGN.md UX15)
- [x] `packages/api-client`: types generated from the API's OpenAPI spec (openapi-typescript + openapi-fetch)
- [x] Home page shows the API health status through the typed client
- [x] Route groups scaffolded: public, `/dashboard`, `/admin` (empty, `noindex`)

**Done when:** `pnpm dev` runs web + API together, and the home page renders in placeholder brand colors with the API status.

### P0-T5 · CI pipeline
`infra` · Depends on: P0-T4
**Goal:** Every PR is checked automatically.
- [x] GitHub Actions: install (cached), lint, typecheck, test, build
- [x] Postgres+PostGIS service container for integration tests (tests create their own database, so `DATABASE_URL` must be a user allowed to `CREATE DATABASE`)
- [x] Turborepo caching in CI
- [x] Required status check on `develop` and `production` (branch protection, set up by you: require the `checks` job)

**Done when:** a PR shows green checks, and a deliberately broken test turns them red.

### P0-T6 · Staging deploy
`infra` · Depends on: P0-T5
**Goal:** The walking skeleton is live on staging (the ROADMAP Phase 0 exit criterion).
- [ ] Accounts (by you): Vercel, Railway, Neon (or Railway Postgres), Cloudflare. All in the Singapore region
- [ ] Web → Vercel; API → Railway; DB → managed Postgres + PostGIS
- [ ] Env vars and secrets set per environment
- [ ] Migrations run automatically on deploy
- [ ] `develop` deploys to staging; `production` deploys to prod (prod can stay empty for now)

**Done when:** the staging URL shows the home page with a live API/DB health status.

### P0-T7 · Error monitoring
`infra` · Depends on: P0-T6
- [ ] Sentry in web (client + server) and API, with source maps
- [ ] Personal data scrubbed from events
- [ ] Uptime check on API `/health`

**Done when:** a test error thrown on staging appears in Sentry for both web and API.

---

## Phase 0 — Design

### P0-D1 · Clickable prototype — owner screens
`design` · Depends on: —
- [ ] Mobile-first prototype of home, results (list ⇄ map), clinic page, emergency view, and report sheet (DESIGN.md §5)
- [ ] Uses the placeholder brand and realistic sample data (fictional clinics)
- [ ] Openable on a phone during interviews

**Done when:** you can run the 4 journeys in `pitch/pet-owners.md` §6 on your phone.

### P0-D2 · Clickable prototype — clinic screens
`design` · Depends on: P0-D1
- [ ] "Your free page" example, hours editor (DESIGN.md UX13), `/for-clinics` page, one-tap confirm page

**Done when:** you can show a clinic its example page and the hours editor during a visit.

### P0-D3 · Brand kit
`design` `business` · Depends on: P0-V4 (brand name)
- [ ] Logo (full + icon, light/dark), favicon/app icon, palette, font, image direction (DESIGN.md §7)
- [ ] Palette checked for WCAG AA contrast; the token file updated to replace the placeholders

---

## Phase 0 — Validation (optional to track as issues)

### P0-V1 · Clinic interviews (10+)
`business` · Uses `pitch/clinics.md`. Notes go in the §10 template.
### P0-V2 · Pet owner interviews (15+)
`business` · Uses `pitch/pet-owners.md`. Notes go in the §10 template.
### P0-V3 · Seed list spreadsheet
`business` · Every vet clinic in Angeles / Mabalacat / Clark: source, services, hours, contacts, date confirmed. Its columns should match the CSV import format (P1-2e).
### P0-V4 · Brand name + domain
`business` · Decide the name, check the domain and social handles are free, register the domain.
### P0-V5 · Privacy notice + terms (draft)
`business` · Template-based draft, for review before launch (PRD §11).
### P0-V6 · Validation checkpoint review
`business` · Depends on: P0-V1, P0-V2
Answer the checkpoint questions in ROADMAP.md, update the PRD, DESIGN.md §6, and pitch kits, then re-scope P1-8 to P1-11b and remove their `blocked` labels.

---

## Phase 1 — Directory MVP

### P1-1 · Core schema
`backend` · Depends on: P0-T3
**Goal:** The Phase 1 data model from ARCHITECTURE.md §5.1 (the parts not tied to auth).
- [x] Tables: `business`, `branch` (PostGIS point), `branch_hours`, `branch_hours_exception`, `species`, `service_category` (+ synonyms), `branch_service` (+ `price_unit`), `product`, `media`, `audit_log`
- [x] Enums: business type (only `vet_clinic` enabled), claim status, listing status
- [x] PSGC reference data (province → city → barangay) for Pampanga to start
- [x] Seed: species list, service categories with Filipino synonyms (kapon, bakuna, purga…)
- [x] Naming follows CLAUDE.md (`business`, never `clinic`)

**Done when:** migrations and seeds run cleanly, and integration tests cover the key constraints.

### P1-2a · Auth for PAW ops
`backend` `ops` · Depends on: P1-1, P0-T4
- [ ] Better Auth in the API (email OTP / magic link + Google); session cookies across web ↔ API
- [ ] `platform_role` (`user` | `super_admin`); a script to promote your account
- [ ] `/admin` route guard in web + API authorization in the service layer
- [ ] Rate limits on auth endpoints

**Done when:** only a super_admin can reach `/admin` and the admin API routes, and tests prove other users get 401/403.

### P1-2b · Admin: businesses & branches
`ops` · Depends on: P1-2a
- [ ] Listings table (search, filter by city / claim status / listing status)
- [ ] Create/edit business + branches (address with PSGC picker, map pin, contact channels, 24h/emergency flags)
- [ ] Every write records an `audit_log` entry; audit log viewer

**Done when:** you can create a full business with 2 branches by hand, and see the audit trail.

### P1-3 · Hours logic (`packages/domain`)
`backend` · Depends on: P0-T1 (can run in parallel with P1-1 / P1-2)
- [ ] Pure functions: `isOpenNow`, `closesAt`, `nextOpening`, `openStatus` (the DESIGN.md UX4 states), `freshness` (UX5 thresholds)
- [ ] Handles lunch breaks, overnight intervals, date exceptions, 24h, and "no hours data" (UX17); `Asia/Manila`
- [ ] Heavy unit tests covering the edge cases

**Done when:** tests cover every UX4/UX5/UX17 state, including overnight and holiday cases.

### P1-2c · Admin: hours & exceptions editor
`ops` `frontend` · Depends on: P1-2b, P1-3
- [ ] `HoursEditor` component (DESIGN.md UX13): weekly grid, multiple intervals, copy to weekdays, overnight, exceptions calendar, live preview of how owners see it
- [ ] "Confirm hours" action (sets `hours_confirmed_at`/`_by = paw_ops`)

**Done when:** you can enter a clinic with a lunch break plus a holiday closure, and the preview shows the right status.

### P1-2d · Admin: services, products & photos
`ops` · Depends on: P1-2b
- [ ] Branch services (category, species, price range + unit, notes), with "copy to all branches"
- [ ] Products (name, price, availability, image)
- [ ] Photo upload to Cloudflare R2 via presigned URLs; required alt text; ordering

**Done when:** a listing can be fully filled in from the admin, including photos.

### P1-2e · Admin: CSV import
`ops` · Depends on: P1-2b, P1-2c, P1-2d
- [ ] CSV format documented (matches the P0-V3 spreadsheet columns)
- [ ] Upload → Zod validation → row-by-row preview with errors → confirm import
- [ ] Duplicate detection (name + distance / phone match)
- [ ] Imported rows record their data source + confirmation date

**Done when:** you can import your seed spreadsheet and fix any flagged rows.

### P1-4 · Public clinic page
`frontend` · Depends on: P1-2b, P1-3 (real data helps: P1-2e)
- [ ] Server-rendered page at `/{province}/{city}/{business}` (DESIGN.md UX8 layout)
- [ ] Status, freshness, verified/unclaimed display (UX4–UX6, UX17), sticky ContactBar (UX9), prices (UX10), hours table, species, photos, branches
- [ ] Contact deep links (tel, Messenger, Viber, Google Maps/Waze with a remembered choice)
- [ ] JSON-LD (`VeterinaryCare`), OG tags; on-demand revalidation when a listing is edited
- [ ] Performance budget checked (DESIGN.md §9); 3–5 person usability check

**Done when:** a seeded clinic page is live on staging, passes the budget, and you've shown it to at least one clinic.

### P1-5a · Search API
`backend` · Depends on: P1-1, P1-3
- [ ] `GET /v1/search`: full-text search + `pg_trgm` + synonym expansion; PostGIS radius + distance ordering
- [ ] Filters: species, category, open now, emergency/24h; excludes "no hours data" listings from open-now (UX17)
- [ ] Ranking: relevance × distance × boosts (verified, fresh)
- [ ] Results are a union of branch and service hits; cursor pagination
- [ ] `search_log` (no personal data, coarse area)

**Done when:** integration tests prove "kapon", typos, species filters, and open-now behave correctly.

### P1-5b · Search UI: home, results, emergency view
`frontend` · Depends on: P1-5a, P1-4
- [ ] Home (UX1): search box, quick chips, location prompt, city picker fallback
- [ ] Results list (UX2/UX3), filter sheet, zero-results state (UX12)
- [ ] Emergency view (UX7)
- [ ] Usability check (3–5 people)

**Done when:** the 4 owner journeys (pitch kit §6) work on staging on a phone, apart from the map.

### P1-5c · Map view
`frontend` · Depends on: P1-5b
- [ ] MapLibre + tile provider, lazy-loaded; list ⇄ map toggle on mobile, split view on desktop
- [ ] Pins synced with the list; tap a pin → card

**Done when:** the map loads only when toggled, and the performance budget still holds.

### P1-6 · SEO landing pages + sitemap
`frontend` · Depends on: P1-5b
- [ ] City, service × city, and 24-hour landing pages (ARCHITECTURE.md §8 URLs)
- [ ] Dynamic `sitemap.xml`, `robots.txt`, canonical URLs, OG images
- [ ] `/for-clinics` page (from P0-D2 learnings)

**Done when:** the pages are indexable on staging and pass Lighthouse SEO checks.

### P1-7 · Report incorrect info
`frontend` `backend` `ops` · Depends on: P1-4
- [ ] Report sheet (UX11) with invisible Cloudflare Turnstile; rate limits
- [ ] `correction_report` API + admin queue; "apply correction" action with audit log

**Done when:** a report submitted on staging shows up in the admin queue and can be applied in one click.

### P1-11a · Event tracking + ops stats
`backend` `ops` · Depends on: P1-4, P1-5a
- [ ] `listing_event` logging (view, call, Messenger, directions clicks); no personal data
- [ ] Daily rollups via a scheduled job (or SQL until the worker exists)
- [ ] `/admin` stats: coverage and freshness per city, zero-result searches, top searches, contact clicks

**Done when:** clicking Call on staging shows up in the next day's stats.

---

> **🛑 Validation checkpoint (P0-V6).** The issues below are drafts. Label them `blocked` and re-scope them after the checkpoint.

### P1-8 · Clinic accounts + claim flow `blocked`
Phone/email OTP for clinic users, `business_member`, phone verification of the listed number, PRC number + permit upload (private R2 bucket, signed URLs), admin claims queue, verified badge.

### P1-9 · Clinic dashboard `blocked`
Mobile-first `/dashboard`: overview, profile, branches, hours editor (reuses P1-2c), services, products, photos, correction reports.

### P1-10 · Worker + hours-confirmation nudges `blocked`
`apps/worker` with pg-boss; monthly nudge (channel decided at the checkpoint) with a one-tap `/confirm/{token}` page; stale-listing flags.

### P1-11b · Monthly clinic stats email `blocked`
Monthly report to claimed clinics (content decided at the checkpoint).

### P1-12 · Launch hardening
`infra` · Depends on: everything above
Privacy/terms pages, rate-limit review, backups + a tested restore, Playwright end-to-end tests for the critical flows, a performance pass on a real mid-range Android, production deploy.
