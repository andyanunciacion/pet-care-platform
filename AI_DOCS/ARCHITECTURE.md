# PAW — Architecture

> **How** PAW is built. For product scope see [PRD.md](PRD.md); for build order see [ROADMAP.md](ROADMAP.md).
> Decisions and the reasons behind them are in §11. When a decision changes, update this file so it always describes the current plan.

## 1. Guiding constraints

- **Solo founder + Claude.** Fewer moving parts beats theoretical scalability. Every service we add has to be worth maintaining.
- **TypeScript everywhere.** One language across web, API, and mobile means shared types, shared validation, and shared domain logic, and a single toolchain to maintain.
- **Managed services over self-hosting.** Pay a little money to save a lot of time.
- **All business logic lives in the API.** The web app and the mobile app are clients, so rules are never duplicated.
- **Host in Singapore** (closest major region to the Philippines) for every service that allows choosing a region.
- **Tech is chosen on fit, not familiarity.** The founder is open to any language; TypeScript won on merits for this project (see D1).

## 2. System overview

```
                   ┌──────────────────────────────┐
  Pet owners ─────▶│ apps/web (Next.js)           │
  Clinic staff ───▶│  • public site (SSR, SEO)     │──┐
  PAW ops ────────▶│  • /dashboard (clinic admin)  │  │
                   │  • /admin (super admin)       │  │  HTTPS + JSON
                   └──────────────────────────────┘  │  (typed client)
                   ┌──────────────────────────────┐  │
  Pet owners ─────▶│ apps/mobile (Expo) — Phase 2 │──┤
                   └──────────────────────────────┘  ▼
                                          ┌─────────────────────┐
                                          │ apps/api (Fastify)  │
                                          │  REST /v1 + OpenAPI │
                                          │  auth, RBAC, logic  │
                                          └──────────┬──────────┘
                              ┌──────────────────────┼─────────────────────┐
                              ▼                      ▼                     ▼
                   ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
                   │ PostgreSQL+PostGIS │◀─│ apps/worker      │  │ Object storage   │
                   │ data, search, geo, │  │ (pg-boss jobs)   │  │ (Cloudflare R2)  │
                   │ job queue          │  └────────┬─────────┘  └──────────────────┘
                   └────────────────────┘           ▼
                                        Email (Resend) · SMS (PH gateway) · Push (P2)
```

## 3. Tech stack

### 3.1 Monorepo & tooling
| Concern | Choice | Why |
|---|---|---|
| Runtime | **Node.js 24 LTS** (pinned in `.nvmrc` + `engines`) | Supported until April 2028; see D13 |
| Package manager / workspaces | **pnpm** workspaces, shared tool versions in a pnpm **catalog** | Fast, strict about dependencies, standard for TS monorepos. The catalog keeps one version of each tool across packages |
| Task runner | **Turborepo** | Cached builds, lint, and typecheck across apps with minimal config |
| Language | **TypeScript 6.0** (`strict: true`) | See §1 and D14 |
| Validation | **Zod** | One schema serves as runtime validation, TS type, and OpenAPI source |
| Lint / format | **ESLint (flat config) + Prettier** | Mainstream, best documented, and has Next.js-specific lint rules |
| Tests | **Vitest** (unit/integration), **Playwright** (end-to-end) | Fast, TS-native. One root Vitest run covers every package (Vitest "projects") |
| CI | **GitHub Actions** (`.github/workflows/ci.yml`) | Format check, lint, typecheck, test (against a Postgres+PostGIS service container), and build on every PR and on pushes to `develop`/`production`. Turborepo's local cache is kept between runs with `actions/cache` (no remote-cache account needed) |

### 3.2 API — `apps/api`
| Concern | Choice | Why |
|---|---|---|
| Framework | **Fastify** + `fastify-type-provider-zod` | Mature, fast, long-running server (good for jobs and uploads), strong plugins (`@fastify/rate-limit`, `@fastify/helmet`, `@fastify/cors`, `@fastify/multipart`) |
| API style | **REST, `/v1`**, OpenAPI generated from Zod route schemas (`@fastify/swagger`) | Works for web, mobile, and future partners; public GET responses can be cached by a CDN |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | SQL-like and type-safe; handles PostGIS/raw SQL cleanly (Prisma does not support PostGIS natively) |
| Auth | **Better Auth** | TS-native. Phone OTP, email OTP, Google, sessions, an organization/member plugin (clinic teams), and Expo support. Replaces hand-rolled JWT/OTP code |
| Errors | RFC 9457 `application/problem+json` | One consistent error shape for all clients |
| Logging | pino (Fastify's built-in logger), structured JSON, no personal data | |

### 3.3 Web — `apps/web`
| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | Server rendering and static/incremental regeneration for SEO. One app hosts the public site, `/dashboard`, and `/admin` (route groups), so there's one deploy and one design system |
| Styling / UI | **Tailwind CSS + shadcn/ui** | Fast and consistent; you own the component code |
| Server data | Server Components fetch from the API through the typed client; client-side mutations and interactivity use **TanStack Query** | |
| Forms / tables | react-hook-form + Zod · TanStack Table | The same Zod schemas as the API |
| Maps | **MapLibre GL JS** with a free or low-cost vector tile provider (OpenFreeMap / MapTiler) | Avoids Google Maps JS per-load costs; directions use Google Maps/Waze deep links instead |
| Charts (P2) | Recharts | |
| Bot protection | Cloudflare **Turnstile** | Free; used on "report info", OTP requests, and claim forms |

### 3.4 Mobile — `apps/mobile` (Phase 2)
| Concern | Choice | Why |
|---|---|---|
| Framework | **Expo (React Native)** + Expo Router | Same language, same API client, same Zod schemas, same TanStack Query patterns as web |
| Maps | react-native-maps or MapLibre React Native | Decide in Phase 2 |
| Push | expo-notifications (FCM/APNs underneath) | |
| Builds | EAS Build / EAS Update | Over-the-air updates for JS-only fixes |

### 3.5 Background jobs — `apps/worker`
- **pg-boss**: a job queue stored in Postgres, so there's **no Redis** to run.
- Jobs: sending email/SMS, monthly hours-confirmation nudges, monthly clinic stats reports, stats rollups, cleaning up expired OTPs and uploads.
- The worker shares code with the API (same packages) but runs as a separate process.

### 3.6 Infrastructure (managed)
| Concern | Choice |
|---|---|
| Web hosting | **Vercel** (Pro plan; the Hobby plan is non-commercial). Functions region: Singapore |
| API + worker hosting | **Railway** (or Render / Fly.io), Singapore region |
| Database | Managed **PostgreSQL 16+ with PostGIS** (Neon, Railway, or Supabase), Singapore region, with automated backups |
| Object storage | **Cloudflare R2**: public bucket for photos, **private** bucket for claim documents (signed URLs only) |
| DNS / CDN | Cloudflare |
| Email | **Resend** (or AWS SES) |
| SMS | Philippine gateway (**Semaphore**; compare with alternatives on delivery rate and price). Twilio as a fallback |
| Errors / monitoring | **Sentry** (web, API, worker, mobile) + uptime checks |
| Payments (P3) | **PayMongo** (GCash, Maya, cards) |

## 4. Monorepo layout (packages are added as their slices ship)

```
paw/
├── apps/
│   ├── web/          Next.js — public site, /dashboard, /admin
│   ├── api/          Fastify REST API
│   ├── worker/       pg-boss job runner
│   └── mobile/       Expo app (Phase 2)
├── packages/
│   ├── db/           Drizzle schema, migrations, seed + CSV import scripts
│   ├── contracts/    Shared Zod schemas & types (forms, API payloads, enums)
│   ├── api-client/   Typed client generated from the API's OpenAPI spec (openapi-typescript + openapi-fetch)
│   ├── domain/       Pure business logic shared by api & worker (e.g. "is open now", slug rules)
│   └── config/       Shared tsconfig / lint presets
├── AI_DOCS/          PRD, architecture, roadmap
├── docker-compose.yml   Local Postgres+PostGIS
└── CLAUDE.md
```

## 5. Data model

Conventions:
- Ids are UUIDs (v7, time-sortable).
- Every table has `created_at` / `updated_at` (timestamptz).
- Soft-delete (`deleted_at`) only where history matters.
- Money is stored as **integer centavos** (PHP).
- Column names are snake_case in SQL; Drizzle maps them from camelCase TypeScript fields automatically.
- Times are stored in UTC; business-hour fields are local wall-clock times interpreted in `Asia/Manila`.
- Phone numbers use E.164 format (`+63…`).
- Addresses carry **PSGC codes** (Philippine Standard Geographic Code) for province, city/municipality, and barangay, so city landing pages and filters are clean.

### 5.1 Phase 1 entities

| Entity | Key fields | Notes |
|---|---|---|
| `user` | name, email?, phone?, platform_role (`user` \| `super_admin`) | Managed by Better Auth (plus its session/account/verification tables) |
| `business` | name, slug, type(s) (enum; only `vet_clinic` enabled at launch — see §5.3), description, logo, `claim_status` (`unclaimed` \| `pending` \| `verified`), `listing_status` (`published` \| `hidden` \| `permanently_closed`), data_source | One brand/owner |
| `branch` | business_id, name, slug, address lines, psgc codes, `location geography(Point,4326)`, phone, messenger_url, viber, email, is_24h, accepts_emergencies, `hours_confirmed_at`, `hours_confirmed_by` (`clinic` \| `paw_ops` \| `report`) | **Most public data hangs off the branch** |
| `branch_hours` | branch_id, day_of_week, opens_at, closes_at | Multiple rows per day (lunch breaks). `closes_at < opens_at` = overnight |
| `branch_hours_exception` | branch_id, date, is_closed, intervals (jsonb), note | Holidays and special closures |
| `business_member` | user_id, business_id, role (`owner` \| `manager` \| `staff`), branch_ids? | Only `owner` is used in P1; the table exists from day 1 |
| `claim_request` | business_id, user_id, status, prc_license_no, document keys, phone_verified_at, reviewed_by, review_notes | |
| `species` | code, name | dog, cat, rabbit, bird, reptile, small mammal, fish, livestock… |
| `service_category` | code, name, parent_id?, synonyms[] | e.g. `spay_neuter` with synonyms `kapon`, `castration` |
| `branch_service` | branch_id, category_id, name, description, price_min, price_max, `price_unit` (`per_visit` \| `per_night` \| `per_session` …), price_note, species_ids[] | A "copy to all branches" helper lives in the UI. `price_unit` is cheap now and needed for boarding later |
| `product` | business_id, name, category, price, image, availability (`available` \| `limited` \| `out`) | No stock counts |
| `media` | owner_type, owner_id, storage_key, alt, sort_order | |
| `correction_report` | branch_id, field, current_value, suggested_value, note, reporter_contact?, status, resolved_by | |
| `listing_event` | branch_id, type (`view` \| `call_click` \| `messenger_click` \| `directions_click` \| …), session_hash, created_at | No personal data; rolled up daily |
| `search_log` | query, filters (jsonb), area (coarse), result_count, created_at | Powers zero-result reports |
| `audit_log` | actor_id, action, entity_type, entity_id, diff (jsonb), created_at | Every admin/dashboard write |

### 5.2 Later entities
- **P2:** `pet`, `favorite`, `staff_profile`, `appointment_request`, `inquiry_thread` / `inquiry_message`, `review` / `review_reply`, `notification`, `reminder`, `push_token`.
- **P3:** `plan`, `subscription`, `featured_placement`, `reservation`, `pet_health_record`.

### 5.3 Adding other business types later (groomers, boarding, pet shops)

Launch is vets only, but the model is type-agnostic so adding other types needs no redesign.

**Rules from day 1:**
- Name things `business` / `branch` in the schema, API, and code. "Clinic" is UI copy for the vet type only.
- Keep URLs free of the business type (`/{province}/{city}/{business-slug}`). Type-specific landing pages (`/…/vets`, `/…/groomers`) are generated from the type enum.
- Grooming and boarding **service categories** exist in P1, because many vet clinics offer them.
- Make vet-only rules depend on the business type instead of hard-coding them everywhere: PRC license at claim time, the emergency / 24-hour flags, and vet staff credentials.

**Work left when a type is added:**
- Enable the enum value.
- Add its service categories.
- Configure its claim verification (business permit only, no PRC).
- Add landing pages and a type filter in search.
- Adjust UI copy.
- For boarding, maybe capacity/size fields.
- For pet shops, the product catalog becomes central, which fits P3 commerce.

Estimated effort: a few slices, not a rewrite.

## 6. Search design (Phase 1: Postgres only)

- One endpoint: `GET /v1/search?q&lat&lng&radius_km&species&category&open_now&emergency&cursor`.
- **Text matching:** Postgres full-text search (`tsvector` over business, branch, and service names/descriptions) combined with **`pg_trgm`** fuzzy matching for typos. The query is expanded with `service_category.synonyms` (Filipino terms).
- **Geo:** PostGIS `ST_DWithin` for the radius filter and `<->` KNN ordering for distance.
- **Ranking:** text relevance × distance decay × boosts (verified, recently confirmed hours). Later, "Sponsored" results are shown **separately** and labeled, never silently mixed in.
- **Open now:** computed in `packages/domain` from hours plus exceptions in `Asia/Manila`, and unit-tested heavily (overnight hours, lunch breaks, holidays).
- Results can be of type `branch` or `service`. The response is a discriminated union.
- **When to revisit:** if search quality or latency degrades (thousands of listings across many cities), add Meilisearch/Typesense fed by the worker.

## 7. Auth & authorization

- **Better Auth** runs in the API. The web app uses HTTP-only cookies scoped to the parent domain (`api.<domain>` + `<domain>`). The mobile app uses Better Auth's Expo integration.
- **Methods:** phone OTP (SMS), email OTP / magic link, Google. Phase 1 only needs accounts for clinic staff and PAW ops.
- **RBAC** is enforced in the API service layer, never only in the UI:
  - `platform_role` controls `/admin`.
  - `business_member.role` controls a business's data.
- **Rate limits** apply to OTP send/verify (per phone and per IP), report submission, and login. Turnstile protects the public forms.

## 8. Web rendering & SEO

- Clinic, branch, and landing pages are statically generated with on-demand revalidation (cache tags invalidated when a clinic edits data).
- URL scheme (draft):
  - `/{province}/{city}/{business-slug}` (branch pages nest under it when there are several)
  - `/{province}/{city}/vets`
  - `/{province}/{city}/services/{category}`
  - `/24-hour-vets/{city}`
- JSON-LD structured data (`VeterinaryCare`, `OpeningHoursSpecification`, `GeoCoordinates`), a dynamic `sitemap.xml`, canonical URLs, and Open Graph images.
- `/dashboard` and `/admin` are `noindex` and client-heavy.

## 9. Security, privacy & quality

- **Secrets and config:**
  - Env vars are validated with Zod at startup, and the app refuses to boot if one is invalid.
  - Secrets live only in the hosting platform's secret stores.
  - `.env*` files are gitignored.
- **Personal data:**
  - Claim documents go in a private bucket and are shown only through short-lived signed URLs.
  - Personal data never goes into logs or analytics events.
  - Personal data follows a documented retention policy (Data Privacy Act; see PRD §11).
- **Database:** automated daily backups plus a tested restore procedure before launch.
- **Testing:**
  - Unit tests for `packages/domain` (hours logic, ranking).
  - API integration tests against a real Postgres+PostGIS (Docker). Each test run creates its own database from `template1`, applies the migrations, and drops it afterwards, so tests see exactly what production has.
  - Playwright end-to-end tests for the critical flows: search → clinic page → contact; claim → approve; edit hours.
- **Environments:** local (docker-compose), **staging** (preview deploys plus a staging DB), production. Migrations run in CI/CD, never by hand in production.

## 10. Cost estimate (Phase 1, pre-traction)

Rough figures as of late 2026. **Verify current pricing before committing.**

| Item | Est. monthly |
|---|---|
| Vercel Pro | ~US$20 |
| Railway (API + worker) | ~US$5–20 (usage-based) |
| Managed Postgres + PostGIS | US$0–25 (free tiers exist; paid tier for backups/no sleeping) |
| Cloudflare (DNS, R2, Turnstile) | ~US$0 at this scale |
| Resend email | US$0 (free tier) |
| SMS (claim verification, nudges) | Pay-per-message; low volume in P1. Budget ~₱500–1,500 |
| Map tiles | US$0 (free tier / OpenFreeMap) |
| Sentry | US$0 (free tier) |
| Domain | ~US$12–40 per **year** (`.ph` costs more) |
| **Total** | **~US$30–70/month** |

**Cost levers:**
- SMS is the cost that grows fastest in P2 (owner OTP, reminders). Push email/Google login and push notifications to keep it down.
- Avoid paid geocoding: clinics and PAW ops drop a map pin instead.

## 11. Decision log

| # | Decision | Why | Revisit when |
|---|---|---|---|
| D1 | **TypeScript end-to-end** (Fastify API, Next.js, Expo) instead of FastAPI + Flutter | Shared Zod schemas (API validation = form validation); shared domain logic (the same "open now" code filters search on the server and updates the badge in the browser on cached pages); Better Auth has no Python equivalent covering OTP + orgs + Expo; one toolchain for a solo founder. FastAPI was a strong alternative on its own merits (Pydantic, SQLAlchemy/GeoAlchemy2) but only wins when Python-specific work is central. Hono was a close TS alternative; Fastify picked for maturity as a long-running server | A Python-heavy need appears (ML, recommendations, data pipelines) — add it as a separate Python service behind the API then |
| D2 | **Postgres (FTS + pg_trgm + PostGIS) for search**, no Meilisearch in MVP | Enough for thousands of listings; no index to keep in sync | Search quality/latency issues or multi-region scale |
| D3 | **pg-boss** instead of Redis + BullMQ/Celery | One less service to run | Very high job volume |
| D4 | **Admin inside the Next.js app** (`/dashboard`, `/admin`) instead of a separate Vite/Refine app | One deploy, one design system, less code | Admin needs diverge strongly or the team grows |
| D5 | **Mobile app deferred to Phase 2, built with Expo** | P1 value is fully delivered by a fast mobile web; the app matters once reminders/bookings exist | — |
| D6 | **No real-time chat**; async inquiries + Messenger/Viber/call links | Clinics already live on Messenger; real-time infra is costly to run | Inquiry volume proves demand |
| D7 | **MapLibre + free tiles**; directions via Google Maps/Waze deep links | Cost control; users already navigate with those apps | Tile quality issues |
| D8 | **Owner accounts deferred to Phase 2** | Supply (clinics) is the P1 bottleneck; browsing needs no login; saves SMS costs | — |
| D9 | **Branch-first data model** from day 1 | Retrofitting multi-branch later touches every table | — |
| D10 | **Better Auth** instead of hand-rolled JWT/OTP | Security-sensitive code we shouldn't write ourselves; supports orgs + Expo | Library stagnates |
| D11 | **Singapore region** for all hosting | Lowest latency to PH among major providers | A PH region becomes available |
| D12 | **Vets-only launch on a type-agnostic model** (`business` / `branch`, never `clinic`, in schema and API) | Adding groomers, boarding, and pet shops later becomes mostly data, taxonomy, and UI copy rather than migrations (see §5.3) | — |
| D13 | **Node 24 LTS** instead of Node 22 | Node 22 reaches end-of-life in April 2027, months after launch; 24 is supported until April 2028. ESLint 10 also needs Node ≥ 22.13 | Node 26 becomes LTS (Oct 2026); upgrade well before April 2028 |
| D14 | **TypeScript 6.0.x**, not 7 (the native Go compiler) | typescript-eslint's type-aware rules need the JS compiler API, which TS 7 doesn't ship yet (peer range `<6.1.0`). Pinned with `~6.0.x` in the pnpm catalog | typescript-eslint supports TS 7 |
| D15 | **Node runs the API's TypeScript directly** (type stripping, built into Node 24): no build step, no `tsx`/`ts-node`; `tsc` only type-checks | Fewer moving parts: what runs in dev is what runs in prod, and workspace packages can export `.ts` source without their own build. Cost: `.ts` extensions in relative imports and no enums/namespaces (`erasableSyntaxOnly`) | A dependency needs non-erasable TS syntax, or startup time matters (bundle with esbuild/tsdown then) |
| D16 | **node-postgres (`pg`)** as the Postgres driver | The most widely used driver; supported by Drizzle and used internally by pg-boss, so API, worker, and jobs share one driver | — |
| D17 | **Drizzle 0.45 (stable)**, not the 1.0 release candidate | Boring over new: 1.0 was still an RC in Sept 2026. Migrations are plain SQL files, so upgrading later is cheap | Drizzle 1.0 is released (upgrade with `drizzle-kit up`) |
| D18 | **Migrations applied by our own script** (`runMigrations()` from drizzle-orm's migrator), not `drizzle-kit migrate` | The same code runs locally, in tests, and on deploy, and production doesn't need the drizzle-kit dev tool installed | — |
| D19 | **next-intl** for UI strings, without locale routing | The standard i18n library for the App Router, with type-checked message keys. English only at launch, so no `/en` in URLs; the URL scheme in §8 stays unchanged | Filipino is added (pick locale by cookie/header, or add routing) |
| D20 | **API client generated from the API's own route schemas** (`pnpm api:generate` → `openapi.json` + types, both committed) | One source of truth (Zod on the routes); the spec diff shows API changes in PR review; a test fails when the client is stale | — |
| D21 | **Next.js default rendering model**, not Cache Components (opt-in in Next 16) | Fewer new concepts while the skeleton is built; per-request parts use `connection()`, which works in both models | Slice 4: decide how clinic pages are cached and revalidated (§8) |
| D22 | **ESLint 10 with `eslint-config-next`** although three of its plugins (react, jsx-a11y, import) only declare ESLint 9 | They work once the React version is set explicitly (auto-detect uses a removed API); `apps/web/eslint.test.ts` proves their rules still fire | Those plugins declare ESLint 10 support (remove the workaround) |
