# PAW — Roadmap

> **Order and progress.** Scope details are in [PRD.md](PRD.md); technical design is in [ARCHITECTURE.md](ARCHITECTURE.md).
> Work is split into **vertical slices**: each slice goes end to end (DB → API → UI → tests) and is deployable on its own.
> Tick the checkboxes as slices ship. Timelines depend on weekly hours (an open question), so each phase has **exit criteria** instead of dates.

## Phase 0 — Validation & groundwork

> **Parallel tracks.** Validation and development run at the same time. Technical groundwork and Phase 1 slices 1–7 don't depend on interview results, so they can start now. Slices 8–11 (the clinic-facing features) wait for the **validation checkpoint** below.
> Guardrail: coding must not crowd out validation. Keep a fixed weekly quota of interviews and field visits (e.g. ≥ 3 conversations per week) until the checkpoint.

**Validation (business)**
- [ ] Interview 10+ clinics in Angeles / Mabalacat / Clark. Ask about:
  - how clients find them today
  - how often they get "are you open?" calls
  - willingness to claim a listing and confirm hours monthly
  - what they pay for today (FB ads, flyers)
  - willingness to pay for a Pro plan
- [ ] Interview 15+ pet owners: how they find vets, bad experiences (closed clinic, missing service), which channels they use (FB groups, Messenger, Google).
- [ ] Build the seed list in a spreadsheet: every vet clinic in the launch area, with source, services, hours, contacts, and date confirmed. Note standalone groomers/boarding places as leads for later.
- [ ] Decide on brand name and domain. Register the domain.
- [ ] Draft the privacy notice and terms (template plus review).

**Groundwork (technical)**
- [ ] Monorepo setup: pnpm + Turborepo, TS strict, lint/format, Vitest, `docker-compose` with Postgres+PostGIS.
- [ ] CI on GitHub Actions: lint, typecheck, test, build.
- [ ] Walking skeleton: API `/health`, web home page calling the API through the typed client, deployed to **staging**.
- [ ] Sentry wired into web and API.

**Exit criteria:** seed list covers the launch area; at least ~5 clinics say they'd claim a free listing; the skeleton is deployed to staging; the validation checkpoint (before Phase 1 slice 8) is done.

## Phase 1 — Directory MVP (web + API + admin)

Slices, in order. Ops tooling comes early so seed data entry can start while the public site is being built.

1. [ ] **Core schema:** business, branch, hours, exceptions, species, service categories, branch services, products, media; PSGC reference data.
2. [ ] **Super admin: listings CRUD + CSV import.** Auth for PAW ops. Duplicate detection. Audit log.
3. [ ] **Hours logic** in `packages/domain`: open now, closes at, next opening, stale flag. Heavily unit-tested.
4. [ ] **Public clinic page:** SSR, photos, branches, hours, "last confirmed", services + price ranges, products, contact and directions buttons, JSON-LD. **Validation tool:** once this is deployed to staging, create real pages for the clinics you're interviewing and show them on your phone ("this is your free page — is anything wrong or missing?").
5. [ ] **Search API + search UI:** text + synonyms + filters (species, category, open now, emergency) + distance; list and map (MapLibre); search logging.
6. [ ] **SEO landing pages:** city, service × city, 24-hour; sitemap; Open Graph images.
7. [ ] **Report incorrect info:** public form with Turnstile, ops queue, apply-correction action.
> **🛑 Validation checkpoint (before slice 8).** Review the interview notes and update the PRD. Answer these:
> - Will clinics claim listings?
> - What documents will they actually share (PRC number, permit)?
> - Who updates info in practice (owner, receptionist, or "just message us")?
> - Which channel do nudges go through (SMS, email, Messenger/Viber)?
> - What stats do they care about?
> - Is there any willingness to pay?
>
> Adjust slices 8–11 to match the answers. They may shrink a lot. For example, if clinics prefer to send updates by message, PAW ops edits on their behalf and the dashboard becomes lighter.

8. [ ] **Clinic accounts + claim flow:** Better Auth (phone/email OTP), phone verification of the listed number, PRC number + permit upload (private bucket), ops review queue, verified badge.
9. [ ] **Clinic dashboard:** profile, branches, hours + exceptions, services, products, photos; accept/reject correction reports.
10. [ ] **Worker + hours-confirmation nudges:** pg-boss, monthly email/SMS with a one-tap confirm link, stale-listing flags.
11. [ ] **Event tracking + stats:** listing events, daily rollups, ops stats page (coverage, freshness, zero-result searches), monthly clinic stats email.
12. [ ] **Launch hardening:** privacy/terms pages, rate limits, backups + restore test, Playwright end-to-end tests for the critical flows, performance pass on mid-range Android.

**Exit criteria:** ≥ 90% coverage of the launch area; ≥ 70% of listings with hours confirmed in the last 60 days; production launch; first real clinic claims.

## Phase 2 — Owner accounts & engagement

- [ ] Owner accounts: phone OTP, Google, email. Owner profile.
- [ ] Pet profiles (multiple pets).
- [ ] Favorites.
- [ ] Clinic teams: invite staff with roles.
- [ ] Appointment requests: owner request → clinic inbox → confirm/decline/suggest → notifications.
- [ ] Inquiries: async messaging + notifications.
- [ ] Reviews & ratings + moderation queue + clinic replies (**after legal review**).
- [ ] Staff/vet profiles with PRC-verified credentials.
- [ ] Reminders: appointments and vaccine due dates (email/SMS).
- [ ] Clinic analytics in the dashboard.
- [ ] **Mobile app (Expo):** search, clinic pages, account, pets, favorites, requests, inquiries, push reminders.
- [ ] Add standalone **groomers and boarding** as business types (ARCHITECTURE §5.3). Tentative; only once vet coverage and freshness are solid.
- [ ] Expand coverage: City of San Fernando and the rest of Pampanga.

**Exit criteria:** owners are completing appointment requests and clinics are responding; retention signal (returning owners); clear evidence of which features clinics would pay for.

## Phase 3 — Monetization & commerce

- [ ] Business registration done; PayMongo account.
- [ ] Clinic Pro plan: subscriptions and billing.
- [ ] Featured / sponsored placements (clearly labeled).
- [ ] Add **pet shops** as a business type.
- [ ] Product reservations for in-store pickup + order status tracking.
- [ ] Pet vaccination and visit history.
- [ ] Dispute handling queue.
- [ ] Expand coverage: Tarlac and other Region 3 cities.

## Phase 4 — Scale & retention

- [ ] Content / blog for SEO.
- [ ] Loyalty / rewards.
- [ ] Multi-branch management at scale.
- [ ] Clinic-entered health records.
- [ ] Search engine upgrade if needed (Meilisearch/Typesense), performance and load testing.
- [ ] Filipino-language UI.
