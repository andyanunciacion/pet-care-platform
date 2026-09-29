# PAW

Pet-care discovery platform for the Philippines, launching in Angeles City / Region 3. Pet owners find vet clinics and pet services with accurate hours, services, and prices. Clinics without websites get an SEO-indexed page they maintain themselves.

## Docs — read before feature work
- `AI_DOCS/PRD.md`: what and why (features are tagged by phase: [P1]–[P4])
- `AI_DOCS/ARCHITECTURE.md`: stack, data model, search, auth, decision log
- `AI_DOCS/DESIGN.md`: UX principles, screens, UX decisions, tokens, performance and accessibility budgets. Read it before any UI work.
- `AI_DOCS/ROADMAP.md`: build order as vertical slices. **Tick the checkbox when a slice ships.**
- `AI_DOCS/pitch/`: interview and pitch kits for clinics and pet owners (Phase 0 validation). Keep their feature lists in sync with the PRD.
- `AI_DOCS/archive/`: superseded drafts. Ignore them; don't use them as a source of truth.

If code and docs disagree, ask which is right, then update the one that's wrong. When a decision changes, update ARCHITECTURE.md's decision log in the same change.

## Current status
Phase 0: validation runs in parallel with development. Only Phase 0 groundwork and Phase 1 slices 1–7 are cleared for building. Slices 8–11 wait for the validation checkpoint in ROADMAP.md.

**Work queue:** `AI_DOCS/github-issues.md` breaks the roadmap into GitHub-issue-sized pieces (slice 2 → 2a–2e, 5 → 5a–5c, 11 → 11a/11b; 11a is not blocked). P0-T1 (monorepo foundation), P0-T2 (API skeleton) and P0-T3 (database package) are done; next is P0-T4 (web skeleton), then P0-T5 (CI). P1-1 (slice 1: schema) is also unblocked. The founder creates the issues; branch off `develop` as `<issue#>-<slug>`. Tooling on this machine: nvm-windows, pnpm, Docker Desktop.

## Commands
Node 24 (`.nvmrc`; `pnpm install` refuses other versions) and pnpm (exact version pinned in `packageManager`). Run from the repo root.
- `pnpm install`
- First run: `docker compose up -d`, copy each `.env.example` to `.env` (`apps/api`, `packages/db`), then `pnpm db:migrate`
- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck`: run in every app and package through Turborepo (cached). The API runs at `http://localhost:4000` with OpenAPI docs at `/docs`
- `pnpm test`: all tests once (Vitest projects, one per app/package). **Needs the Docker database running**: each package with DB tests gets its own fresh, migrated `paw_test_…` database per run, dropped afterwards (your dev data is never touched). `pnpm test:watch` for watch mode. One package: `pnpm test --project @paw/api`. One file: `pnpm test path/to/file.test.ts`
- `pnpm format` / `pnpm format:check`: Prettier (docs in `AI_DOCS/` are excluded)
- `docker compose up -d`: local Postgres 16 + PostGIS on `localhost:5432`. `docker compose down -v` wipes the data.
- `pnpm db:generate`: after changing tables in `packages/db/src/schema`, writes a new SQL migration to `packages/db/migrations` (review it and commit it). `pnpm db:generate --custom --name=<name>` gives an empty one for hand-written SQL
- `pnpm db:migrate`: applies pending migrations to `DATABASE_URL` (the dev database locally)
- `pnpm db:studio`: browse the dev database at https://local.drizzle.studio

Adding an app or package: name it `@paw/<name>`, extend `@paw/config/tsconfig.base.json`, add an `eslint.config.js` extending `@paw/config/eslint` (see `packages/config/eslint.config.js`), give it `lint` and `typecheck` scripts, and take shared tool versions from the pnpm catalog (`"typescript": "catalog:"`, defined in `pnpm-workspace.yaml`).

TypeScript runs as-is (Node's type stripping, no build step; ARCHITECTURE D15): relative imports use the `.ts` extension (`import { buildApp } from './app.ts'`), and TS-only runtime syntax (`enum`, `namespace`, constructor parameter properties) isn't allowed. Use `as const` objects or string-literal unions instead of enums.

API conventions (`apps/api`): env vars are declared and validated in `src/env.ts`; routes are Fastify plugins with Zod schemas (see `src/routes/health.ts`); errors are RFC 9457 `application/problem+json` (`src/errors.ts`); tests build the app with `buildApp()` and call it with `app.inject()`.

Database conventions (`packages/db`): tables are defined in `src/schema` and exported from `src/schema/index.ts`. Column names are written camelCase in TypeScript and become snake_case in SQL automatically (`casing: 'snake_case'`). Apps get a connection with `createDatabase()` from `@paw/db`. A package that needs a database in tests adds `globalSetup: ['@paw/db/testing/global-setup']` to its `vitest.config.ts` and reads the URL with `testDatabaseUrl()` from `@paw/db/testing`.

## Working with the founder
- Solo founder, fluent in **TypeScript** and open to other tech when it's the better fit. Learning the rest of the stack (Next.js internals, Fastify, Drizzle, PostGIS, Expo, infra) by reviewing every change.
- Keep changes small, focused, and reviewable: one slice or sub-step at a time.
- Briefly explain **why** for non-obvious choices and patterns (a sentence or two, not a tutorial). Name the concept so it can be looked up.
- Before adding a new dependency or external service, say what it is and why, and prefer what ARCHITECTURE.md already lists.
- This is a real startup: prefer boring, well-documented tech and managed services over clever or self-hosted solutions.

## Engineering conventions
- TypeScript `strict`; no `any` (use `unknown` + narrowing). Zod validates every boundary (HTTP input, env vars, external APIs, CSV imports).
- **Business logic lives in `apps/api` / `packages/domain`.** Web and mobile are clients and never talk to the database directly.
- Authorization is checked in the API service layer (`platform_role` + `business_member.role`), never only in the UI.
- Schema changes go only through Drizzle migrations. Never edit production data by hand.
- Store times in UTC; business hours are wall-clock times in `Asia/Manila`. Money is integer centavos (PHP). Phones are E.164 (`+63…`). Addresses carry PSGC codes.
- Public data hangs off **branch**, not business (hours, address, contacts, services).
- Launch is vets only, but schema, API, and code say `business`, never `clinic`. "Clinic" is UI copy for the vet type. Vet-only rules (PRC, emergency flags) depend on the business type (ARCHITECTURE §5.3).
- No personal data in logs or analytics events. Claim documents live in the private bucket, accessed only through signed URLs.
- Write tests with each change: unit tests for domain logic (especially hours/"open now"), integration tests for API routes against real Postgres+PostGIS.
- Every write from `/dashboard` or `/admin` records an `audit_log` entry.

## Domain glossary
- **Business**: a clinic/groomer/shop brand or owner. **Branch**: a physical location with its own hours and contacts.
- **Claim**: a business owner taking over a PAW-seeded listing (verified by phone + PRC license + permit) → `claim_status = verified`.
- **Hours confirmation**: the clinic (or PAW ops) confirming hours are still correct → `branch.hours_confirmed_at`.
- **Correction report**: a public "report incorrect info" submission.
- **PAW ops / super admin**: the founder's internal role (`/admin`). **Clinic dashboard**: `/dashboard`.
