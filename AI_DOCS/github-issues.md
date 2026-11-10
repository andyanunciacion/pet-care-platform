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
- [x] Accounts (by you): Vercel, Railway (Postgres from Railway's PostGIS template). All in the Singapore region
- [x] Web → Vercel; API → Railway; DB → managed Postgres + PostGIS
- [x] Env vars and secrets set per environment
- [x] Migrations run automatically on deploy (Railway pre-deploy command `pnpm db:migrate`)
- [x] `develop` deploys to staging; `production` deploys to prod (prod can stay empty for now)

**Staging settings** (they live in the dashboards, not in the repo):
- Vercel: Root Directory `apps/web`; Node 24.x; Production Branch `production`, so `develop` gets Preview deploys; `API_URL` (Preview **and** Production: the `/v1` rewrite reads it at build time) = the Railway API URL, with `https://`, no trailing slash. Staging lives at the `develop` branch alias, `https://pet-care-platform-git-develop-a-creates.vercel.app`
- Vercel Deployment Protection (Vercel Authentication) is on for previews: only browsers logged into the Vercel team reach staging. Scripts and `curl` get a 302 to Vercel's login page unless they send the header `x-vercel-protection-bypass: <token>` (Settings → Deployment Protection → Protection Bypass for Automation; regenerate the token after use)
- Railway service `@paw/api`: root directory = repo root (the API imports `packages/db`); build `pnpm install --frozen-lockfile`; pre-deploy `pnpm db:migrate`; start `pnpm --filter @paw/api start`; watch paths `apps/api/**`, `packages/**`
- Railway variables: `DATABASE_URL` built from the PostGIS service's private domain (`….railway.internal`, no egress fees), `HOST=::`, `NODE_ENV=production`, `CORS_ORIGINS` = the Vercel staging URL. Auth adds more (see P1-2a)
- One-off scripts on Railway (e.g. `promote-admin`): `railway ssh` into `@paw/api` opens a shell in `/app`, but `node` and `pnpm` aren't on its `PATH` (Railpack installs them with mise, and only the start command gets them). Find Node with `find / -maxdepth 6 -type f -name node -path '*/bin/*' 2>/dev/null`, `export PATH="<that bin folder>:$PATH"`, then run the script with `node` from its package folder (e.g. `cd /app/apps/api && node scripts/promote-admin.ts --email …`). `DATABASE_URL` is already set in that shell

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

### P0-D4 · Design tooling: Impeccable
`design` `infra` · Depends on: P0-T4 · Do before P1-4 (the first owner-facing page)
**Goal:** Claude reviews and polishes UI with [Impeccable](https://impeccable.style/) (free, Apache 2.0), using PAW's own docs and tokens as its context.
- [ ] Install the plugin (by you): `/plugin marketplace add pbakaus/impeccable`, then install it from `/plugin`. Optional: its anti-pattern check hook (`npx impeccable install`), which lives in the gitignored `.claude/settings.local.json`
- [ ] Run `/impeccable init` on this issue's branch, answering from what PRD.md and DESIGN.md already decide
- [ ] Review what it wrote (`PRODUCT.md`, `DESIGN.md`, `.impeccable/`). Fold anything new into `AI_DOCS/DESIGN.md` (likely a "Voice & tone" section), and keep the root `PRODUCT.md` / `DESIGN.md` as short summaries pointing at `AI_DOCS`, so there's one source of truth
- [ ] `.gitignore`: add its ignore block (`# impeccable-ignore-start/end`); commit `.impeccable/config.json` and `design.json`, not `config.local.json`
- [ ] CLAUDE.md: when to use it, and which commands. Use `critique`, `audit`, `polish`, `typeset`, `layout`, `clarify`, `harden`, `adapt`, `optimize`. Avoid `bolder`, `overdrive`, `delight`, `animate` unless a design decision calls for them: they work against "light on data", "calm in emergencies" and the performance budget (DESIGN §2, §9)
- [ ] ARCHITECTURE decision log: record the tool, and when to revisit it

**Done when:** `/impeccable critique` on the home page gives feedback that uses PAW's tokens and principles, and `AI_DOCS/` is still the only source of truth for product and design decisions.

---

## Phase 0 — Validation (optional to track as issues)

### P0-V1 · Clinic interviews (10+)
`business` · Uses `pitch/clinics.md`. Notes go in the §10 template.
### P0-V2 · Pet owner interviews (15+)
`business` · Uses `pitch/pet-owners.md`. Notes go in the §10 template.
### P0-V3 · Seed list spreadsheet
`business` · Every vet clinic in Angeles / Mabalacat / Clark: source, services, hours, contacts, date confirmed. Use the columns of the CSV import format ([csv-import.md](csv-import.md)); start from the template on `/admin/import`.
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
- [x] Better Auth in the API, with Google sign-in (email/phone OTP moved to P1-8, where clinic accounts need it); session cookies across web ↔ API through the same-origin `/v1` proxy (ARCHITECTURE D31)
- [x] `platform_role` (`user` | `super_admin`); a script to promote your account (`pnpm --filter @paw/api promote-admin --email …`)
- [x] `/admin` route guard in web + API authorization in the service layer
- [x] Rate limits on auth endpoints (D32)

**Done when:** only a super_admin can reach `/admin` and the admin API routes, and tests prove other users get 401/403.

**Staging settings** (by you, after merging to `develop`):
- Google Cloud Console → the OAuth client → Authorized redirect URIs: add `https://<develop branch alias>.vercel.app/v1/auth/callback/google`. That's the stable alias Vercel gives the `develop` branch; per-commit preview URLs can't sign in (D31). Local: `http://localhost:3000/v1/auth/callback/google`
- Railway service `@paw/api` variables: `BETTER_AUTH_SECRET` (new random value, 32+ characters; never reuse the local one), `BETTER_AUTH_URL` = the `develop` branch alias with `https://`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TRUST_PROXY_HOPS` (see below)
- Vercel: `API_URL` must now be set for every environment that builds (the `/v1` rewrite reads it at build time)

**Staging follow-up** (after the settings above):
- [x] Sign in on staging once, run `promote-admin` inside the Railway API service (see the P0-T6 note on `railway ssh`), sign in again: `/admin` works, sign-out works
- [x] `TRUST_PROXY_HOPS=2` is set on staging (Vercel, then Railway's edge). **Not confirmed yet**: deferred to P1-12, and required before P1-8 ships (OTP sends paid SMS, so the limiter must see real client IPs). Low risk until then: staging is behind Vercel Authentication and sign-in is Google-only

**Confirming `TRUST_PROXY_HOPS`** (no IPs are logged; requests need the Vercel bypass header while previews are protected):
1. With the right value, 11 quick `POST /v1/auth/sign-in/social` calls from your laptop end in a 429, while your phone on mobile data can still start Google sign-in within that minute. If the phone is blocked too, the value is too low
2. A minute later, 11 calls with a different forged `X-Forwarded-For` each still end in a 429. If all 11 succeed, the value is too high
3. Record the confirmed value here and in the P0-T6 Railway settings

### P1-2b · Admin: businesses & branches
`ops` · Depends on: P1-2a
- [x] Listings table (search, filter by city / claim status / listing status)
- [x] Create/edit business + branches (address with PSGC picker, map pin, contact channels, 24h/emergency flags)
- [x] Every write records an `audit_log` entry; audit log viewer

Notes for later issues: claim status is read-only in the admin (the claim flow owns it, P1-8); there's no delete (hide instead); the audit log shows PSGC codes, not names; search doesn't ignore accents ("pena" ≠ "Peña"; `unaccent` fits P1-5a).

**Done when:** you can create a full business with 2 branches by hand, and see the audit trail.

### P1-3 · Hours logic (`packages/domain`)
`backend` · Depends on: P0-T1 (can run in parallel with P1-1 / P1-2)
- [x] Pure functions: `isOpenNow`, `closesAt`, `nextOpening`, `openStatus` (the DESIGN.md UX4 states), `freshness` (UX5 thresholds)
- [x] Handles lunch breaks, overnight intervals, date exceptions, 24h, and "no hours data" (UX17); `Asia/Manila`
- [x] Heavy unit tests covering the edge cases

**Done when:** tests cover every UX4/UX5/UX17 state, including overnight and holiday cases.

### P1-2c · Admin: hours & exceptions editor
`ops` `frontend` · Depends on: P1-2b, P1-3
- [x] `HoursEditor` component (DESIGN.md UX13): weekly grid, multiple intervals, copy to weekdays, overnight, exceptions list, live preview of how owners see it
- [x] "Confirm hours" action (sets `hours_confirmed_at`/`_by = paw_ops`)
- [x] One-tap "Closed today" action with an optional note (creates today's closed exception; shown as "Closed today" even when regular hours are unknown, UX4)

Notes for later issues: the editor lives on the branch's Hours tab (`/admin/businesses/{id}/branches/{branchId}/hours`); P1-2d adds its Services / Photos tabs to `BranchTabs`. "Open 24 hours" moved from the branch form to the hours editor. The status display (`components/hours/open-status.tsx`) and `lib/hours-format.ts` are meant for reuse by P1-4, and the editor pieces by the clinic dashboard (P1-9), which needs its own (business-member) routes for the same writes.

**Done when:** you can enter a clinic with a lunch break plus a holiday closure, and the preview shows the right status.

### P1-2d · Admin: services, products & photos
`ops` · Depends on: P1-2b
Shipped as two PRs: services, species treated and products first (no images), then everything on R2.
- [x] Account (by you): Cloudflare; R2 dev bucket `paw-photos-dev` for local work (the private claim-documents bucket waits for P1-8). Staging bucket: see the follow-up below
- [x] Species treated per branch (`branch_species`), on the branch's Services tab
- [x] Branch services (category, species, price range + unit, notes), with "copy to all branches" (overwrites a same-named service in the same category, after a dry run, and adds the service's species to each branch's species treated; ARCHITECTURE D37)
- [x] Products (name, category, price, availability), on the business page
- [x] Product image (one per product), from the product's edit form
- [x] Business logo (one per business), on the business page
- [x] Photo upload to Cloudflare R2 via presigned URLs; required alt text; ordering (branch Photos tab, up to 20 per branch; ARCHITECTURE D38)

**R2 bucket setup** (Cloudflare dashboard; one bucket per environment):
1. R2 → **Purchase R2 Plan** (free tier; Cloudflare asks for a card or PayPal). Optional: Billing → Notifications for a usage alert.
2. Create the bucket (`paw-photos-dev`, `paw-photos-staging`, later production): location Automatic with the **Asia-Pacific** hint, storage class **Standard** (the free tier only covers Standard).
3. Public access: dev uses the bucket's **Public Development URL (r2.dev)** (Settings → Allow). Staging and production need a **custom domain** instead (Settings → Custom Domains → `photos-staging.<domain>` / `photos.<domain>`), which needs the domain's DNS on Cloudflare: `r2.dev` is rate-limited and was unreachable from Philippine networks in testing (it works through Cloudflare WARP, which is fine for dev).
4. Settings → **CORS policy**: `[{"AllowedOrigins":["<web origin>"],"AllowedMethods":["PUT"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]` with `http://localhost:3000` (dev) or the staging URL.
5. Settings → **Object lifecycle rules**: prefix `tmp/`, delete objects after 1 day (abandoned uploads).
6. R2 → Manage API tokens → **Account API token** with Object Read & Write on **that bucket only** (one token per environment). Keep the Access Key ID, Secret Access Key (shown once) and the Account ID.
7. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` in `apps/api/.env` (dev) or Railway's `@paw/api` variables (staging). All five or none: without them the API runs and the image routes answer 503.

**Staging follow-up (by you):** buy the domain (once the brand name is settled) and put its DNS on Cloudflare; then create `paw-photos-staging` with the custom domain `photos-staging.<domain>`, steps 4–6, and the Railway variables. Until then, staging shows "Photo storage isn't set up" on the image screens.

Notes for later issues: services and products are audited on their parent branch or business (D36), and so are images. `lib/price-format.ts` + `lib/price-labels.ts` turn prices into the UX10 labels and are meant for reuse by P1-4. Services only use subcategories (the API rejects a top-level group). Services have no reorder yet: they're listed by category, then in the order they were added. For P1-4: image URLs come from the API (`url`), stored files are already resized WebP/JPEG; public pages should use `next/image` with `images.remotePatterns` for the photos domain. The clinic dashboard (P1-9) can reuse `ImageUpload` but needs business-member routes for the same writes.

**Done when:** a listing can be fully filled in from the admin, including photos.

### P1-2e · Admin: CSV import
`ops` · Depends on: P1-2b, P1-2c, P1-2d
- [x] CSV format documented ([csv-import.md](csv-import.md), with a template on `/admin/import`; the P0-V3 sheet uses these columns)
- [x] Upload → Zod validation → row-by-row preview with errors → confirm import (ARCHITECTURE D39)
- [x] Duplicate detection (similar name within 250 m / same phone or Viber number)
- [x] Imported rows record their data source + confirmation date (`confirmed_on` → hours confirmed by PAW)

Notes for later issues:
- **What the import doesn't do:** add branches to an existing business (it flags them as duplicates; add those by hand), take prices, or take species per service (services come in as "Call for price").
- **Hours text:** `parseDayHours` (`packages/domain`) reads typed hours ("8am-12nn, 1pm-5pm"). It could serve a paste-hours box in the hours editor or the clinic dashboard (P1-9).
- **Unchecked so far:** the 250 m / 0.3 duplicate thresholds haven't met real data yet; revisit them after the first seed import.

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
Phone/email OTP for clinic users, `business_member`, phone verification of the listed number, PRC number + permit upload (private R2 bucket, signed URLs), admin claims queue, verified badge. Before it ships: confirm `TRUST_PROXY_HOPS` (see P1-2a) and add OTP rate limits per phone and per IP.

### P1-9 · Clinic dashboard `blocked`
Mobile-first `/dashboard`: overview (with "Confirm hours" and "Closed today" buttons), profile, branches, hours editor (reuses P1-2c), services, products, photos, correction reports.

### P1-10 · Worker + hours-confirmation nudges `blocked`
`apps/worker` with pg-boss; monthly nudge (channel decided at the checkpoint) with a one-tap `/confirm/{token}` page; stale-listing flags.

### P1-11b · Monthly clinic stats email `blocked`
Monthly report to claimed clinics (content decided at the checkpoint).

### P1-12 · Launch hardening
`infra` · Depends on: everything above
Privacy/terms pages, rate-limit review (including `TRUST_PROXY_HOPS` on the production proxy chain, see P1-2a), backups + a tested restore, Playwright end-to-end tests for the critical flows, a performance pass on a real mid-range Android, production deploy.
