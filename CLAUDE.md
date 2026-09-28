# PAW

Pet-care discovery platform for the Philippines, launching in Angeles City / Region 3. Pet owners find vet clinics and pet services with accurate hours, services, and prices. Clinics without websites get an SEO-indexed page they maintain themselves.

## Docs — read before feature work
- `AI_DOCS/PRD.md`: what and why (features are tagged by phase: [P1]–[P4])
- `AI_DOCS/ARCHITECTURE.md`: stack, data model, search, auth, decision log
- `AI_DOCS/ROADMAP.md`: build order as vertical slices. **Tick the checkbox when a slice ships.**
- `AI_DOCS/pitch/`: interview and pitch kits for clinics and pet owners (Phase 0 validation). Keep their feature lists in sync with the PRD.
- `AI_DOCS/archive/`: superseded drafts. Ignore them; don't use them as a source of truth.

If code and docs disagree, ask which is right, then update the one that's wrong. When a decision changes, update ARCHITECTURE.md's decision log in the same change.

## Current status
Phase 0: validation runs in parallel with development. Only Phase 0 groundwork and Phase 1 slices 1–7 are cleared for building. Slices 8–11 wait for the validation checkpoint in ROADMAP.md. **The monorepo has not been created yet**, so there are no build/test commands. Add a "Commands" section here once it exists.

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
