# Pet care platform — development plan

## 1. Problem → feature mapping

| Problem you named | Feature(s) that address it | Notes |
|---|---|---|
| Only way to find vets is Google Maps | Universal search, map search, SEO-indexed website | Web pages for each clinic get indexed by Google too — you become *findable inside* Google search, not just an alternative to it |
| Clinics have no website / owners get turned away | Clinic profile with services, specialties, product listings | This is the core value prop — make the profile page do what a website would |
| Owners can't locate a specific service | Universal search + service-level filtering, not just clinic-level | Search needs to return *services*, not just clinics, as first-class results |
| Clinic hours are inaccurate | Availability display + "last confirmed" timestamp + user-reported corrections | Freshness signal matters as much as the data itself |

## 2. System architecture

Four systems, one backend:

- **Website** (pet owners) — public, SEO-critical
- **Mobile app** (pet owners) — on-the-go use, push notifications
- **Admin website** — two roles: clinic/shop admin, and platform super admin
- **Server** — owns all business logic, data, and integrations

*(See the architecture diagram above.)*

## 3. Refined feature set by system

### 3.1 Website & mobile app (pet owner facing)

**From your list, organized:**
- Universal search (clinics, services, products — one search box, ranked results across types)
- Map search (proximity-based, filterable by specialty/service)
- Service & product listings (per clinic/shop)
- Availability (open/closed status, next available slot)
- Clinic specialties (filter: exotic pets, surgery, grooming, boarding, etc.)
- Universal pet profile (multiple pets per owner)
- Owner profile
- Login / Register with OTP
- About us

**Suggested additions:**
- **Appointment requests** — even a lightweight "request a slot, clinic confirms" flow turns "availability" from informational into actionable
- **Reviews & ratings** — this is your single biggest trust-building lever against a bare Google Maps pin
- **Inquiry / chat with a clinic** — pre-visit questions ("do you treat rabbits?") without a phone call
- **"Report incorrect info" button** — crowd-sourced correction for hours, address, phone; directly targets your stated hours-accuracy problem
- **Verified badge** — visually distinguishes claimed/verified clinics from directory-only listings
- **Vaccination & visit history per pet** — ties into the pet profile, gives owners a reason to keep coming back
- **Reminders** — vaccine due dates, upcoming appointments (push + email)
- **Emergency/24-hour filter** — a distinct, high-intent search filter
- **Favorites / saved clinics**
- **Order tracking** for anything bought through a merchant
- **Price ranges on services** — even rough ranges reduce "wasted trip" visits
- **Content/blog section** — pet care articles; helps SEO and gives the "About Us" section somewhere to grow into

### 3.2 Admin website — clinic & merchant admin

**From your list:**
- List of services/products (CRUD)
- Vet/shop profile
- Customer interaction (inquiries, service/order status)

**Suggested additions:**
- **Structured hours management** with holiday/exception overrides, and a required periodic "confirm your hours are still accurate" prompt
- **Staff/vet profiles** — names, credentials, photos on the clinic page build trust
- **Appointment/inquiry inbox** with status tracking (new → confirmed → completed)
- **Basic inventory** for merchants selling physical products
- **Simple analytics** — profile views, inquiry volume, popular services
- **Multi-branch support** if a clinic has more than one location
- **Staff roles/permissions** (owner vs. receptionist vs. vet) — worth designing for even if you launch with a single admin role

### 3.3 Super admin website

**From your list:**
- List of vets / statistics
- Vet application

**Suggested additions:**
- **Claim-a-listing verification workflow** — review submitted business permits/licenses before a clinic goes from "unclaimed directory entry" to "verified"
- **Review moderation** — flagged/reported reviews need a queue
- **Platform-wide analytics** — searches with no results (tells you where supply is missing), most-searched services, growth by region
- **Featured/promoted listings** — a natural, non-intrusive monetization lever
- **Dispute resolution** — for customer-vs-clinic complaints
- **Audit log** of admin actions

### 3.4 Server

**Core services:**
- Auth (OTP + session/JWT)
- Clinic/service/product CRUD APIs
- Universal search service
- Geo/proximity query service
- Notification service (push, email, SMS)
- File/image storage

**Suggested additions:**
- **Background job runner** for reminders, hour-confirmation nudges, digest emails
- **Real-time messaging** for the inquiry/chat feature
- **Audit logging** shared across both admin tiers

## 4. Recommended tech stack

### Website
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (React, TypeScript), App Router | Server-side rendering means clinic pages are indexable by Google — directly supports "be findable outside Google Maps" |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, easy to theme |
| Data fetching | TanStack Query | Caching + sync with server state |
| Maps | Mapbox GL JS (cheaper at scale) or Google Maps JS API | Either works; Mapbox pricing is friendlier past free-tier volume |
| Hosting | Vercel | Zero-config Next.js deploys, good free tier for MVP |

### Mobile app
| Layer | Choice | Why |
|---|---|---|
| Framework | Flutter (Dart) | Single codebase, strong performance for map-heavy and animation-heavy screens, mature widget ecosystem, good hot-reload dev loop |
| State management | Riverpod (or Bloc) | Riverpod has less boilerplate and pairs well with a small-to-mid team |
| Navigation | go_router | Standard for Flutter, handles deep links cleanly |
| Maps | google_maps_flutter or mapbox_gl (Flutter plugin) | |
| Push | firebase_messaging | Unaffected by the framework change — still Firebase |
| API client | Generated from the server's OpenAPI schema via openapi-generator (dart-dio template) | Keeps the Dart client in sync with the backend automatically instead of hand-writing request/response models |

**Trade-off to plan for:** Flutter/Dart doesn't share a language with the Next.js/TypeScript website or admin panel, so a mobile developer here is a distinct hire/skillset from your web frontend team, not an overlapping one.

### Admin website (clinic admin + super admin)
| Layer | Choice | Why |
|---|---|---|
| Framework | Vite + React + TypeScript (SPA) | No SEO need here — an SPA is simpler and faster to build than SSR |
| Admin framework | Refine.dev (on Ant Design or Material) | Scaffolds CRUD tables/forms fast — the bulk of admin work is exactly this |
| Charts | Recharts | For the statistics/analytics views |
| Role split | One codebase, role-gated routes/menus | Cheaper to maintain than two separate apps; separate later only if the two roles diverge a lot |

### Server
| Layer | Choice | Why |
|---|---|---|
| Runtime/framework | FastAPI (Python), async | Auto-generates an OpenAPI schema/docs from your route + Pydantic definitions with no extra setup; async support handles concurrent I/O well (search, geo queries, notifications); strong request/response validation for free |
| ORM | SQLAlchemy 2.0 (async) + Alembic for migrations | Mature and well-documented; SQLModel (same author as FastAPI) is a lighter alternative if you want less boilerplate between Pydantic and SQLAlchemy models |
| API style | REST, OpenAPI-first | The auto-generated schema becomes the single contract every client — web, admin, Flutter — generates a typed client from |
| Auth | fastapi-users, or custom JWT via python-jose + passlib; OTP via an SMS gateway | For the Philippines specifically, compare local providers (e.g. Semaphore, Movider) against Twilio on delivery reliability and cost before committing |
| Database | PostgreSQL + PostGIS, queried via GeoAlchemy2 | Python's geo tooling is just as mature as Node's here — no loss switching |
| Search | Meilisearch (official Python client) | Unchanged recommendation — client library swap only |
| Cache/session | Redis | Also backs OTP codes and job queues |
| Background jobs | Celery + Redis, or arq (lighter, async-native) | Replaces BullMQ; arq is a good fit if you want to stay in FastAPI's async style throughout |
| Real-time | python-socketio | Socket.IO-protocol-compatible, so it pairs with a socket.io-client on web and a socket_io_client package on Flutter |
| File storage | AWS S3 or Cloudinary | Cloudinary adds automatic image optimization, useful for clinic/product photos |
| Payments (Phase 3+) | PayMongo (PH-focused) or Stripe | |
| Hosting | Railway or Render for MVP; migrate to AWS/GCP as you scale | Uvicorn/Gunicorn workers behind either; optimize for speed to launch first |
| Monitoring | Sentry | |

### Cross-cutting
With the server on Python and mobile on Dart, there's no longer one language shared across all four systems — so the integration strategy changes shape rather than disappearing:
- **Turborepo or Nx for Website + Admin only:** both are still TypeScript, so they genuinely benefit from a shared types/components package.
- **OpenAPI-first contract for everything else:** FastAPI's auto-generated schema becomes the source of truth. Generate a typed TS client for the website/admin (e.g. via `openapi-typescript`) and a typed Dart client for Flutter (via `openapi-generator`, dart-dio template) directly from it. This keeps all three "foreign" clients in sync with the Python backend automatically whenever the schema changes, without hand-maintained glue code.

## 5. Data model — key entities

`User` (owner / clinic-staff / super-admin roles) · `Pet` (belongs to owner, supports multiple) · `Clinic` (profile, specialties, location, verification status) · `ClinicHours` (structured schedule + exceptions + last-confirmed timestamp) · `Service` · `Product` · `Appointment/Inquiry` · `Review` · `VetApplication` (claim/verification workflow) · `Order` (Phase 3+)

## 6. Phased roadmap — features by system

### Phase 0 — Discovery & design (3–4 weeks)
No feature build. Finalize requirements, wireframes, DB schema, and the OpenAPI contract that every client will generate against.

### Phase 1 — MVP core (10–14 weeks)

| System | Features |
|---|---|
| **Website** | OTP register/login · universal search · map search · clinic profile pages (services, specialties, structured hours, "last confirmed" timestamp) · product listings (read-only) · universal pet profile (multiple pets) · owner profile · about us · SEO-optimized, server-rendered clinic/service pages |
| **Mobile app** | OTP register/login · universal search · map search · clinic profile pages · universal pet profile · owner profile · push notification opt-in (infrastructure ready, not yet used for reminders) |
| **Admin / super admin** | *Clinic admin:* profile, services, and product management · structured hours + hours-confirmation flow · claim-a-listing / vet application submission. *Super admin:* claim/application review & approval queue · clinic list view |
| **Server** | OTP auth · clinic/service/product CRUD APIs · role-based access control (owner / clinic staff / super admin) · universal search service (Meilisearch) · geo/proximity search (PostGIS) · seed-data import for the initial directory · image upload & storage |

### Phase 2 — Engagement layer (6–10 weeks)

| System | Features |
|---|---|
| **Website** | Appointment/service request flow · reviews & ratings · inquiry/chat with a clinic · "report incorrect info" button · favorites/saved clinics · email reminder opt-in |
| **Mobile app** | Appointment/service request flow · reviews & ratings · inquiry/chat · push reminders (appointments, vaccine due dates) · favorites/saved clinics · emergency/24-hour filter |
| **Admin / super admin** | *Clinic admin:* appointment/inquiry inbox with status tracking · staff/vet profile management · basic analytics (profile views, inquiry volume). *Super admin:* review moderation queue · platform-wide analytics (zero-result searches, growth by region) |
| **Server** | Real-time messaging (python-socketio) · notification service (push + email) · background job runner (Celery/arq) for reminders and hours-confirmation nudges · review storage & moderation endpoints · analytics aggregation endpoints |

### Phase 3 — Marketplace & monetization (8–12 weeks)

| System | Features |
|---|---|
| **Website** | Product cart & checkout · order tracking · price ranges shown on services · featured/promoted clinics in search results |
| **Mobile app** | Product cart & checkout · order tracking · push notifications for order status |
| **Admin / super admin** | *Clinic/shop admin:* inventory management · order management. *Super admin:* featured-listing management · clinic subscription/billing tiers · dispute resolution queue |
| **Server** | Payment gateway integration (PayMongo/Stripe) · order & inventory APIs · subscription/billing logic · audit logging |

### Phase 4 — Scale & retention (ongoing)

| System | Features |
|---|---|
| **Website** | Loyalty/rewards program · vaccination & visit history per pet · content/blog section · multi-branch clinic pages |
| **Mobile app** | Loyalty/rewards program · vaccination & visit history per pet · multi-branch clinic pages |
| **Admin / super admin** | *Clinic admin:* multi-branch management · staff roles/permissions (owner / receptionist / vet). *Super admin:* advanced platform analytics & reporting |
| **Server** | Search infrastructure scale-up (Meilisearch cluster, or migrate to Elasticsearch if needed) · caching-layer tuning · multi-branch data model support · performance monitoring & load testing |

## 7. Suggested core team

Product/PM · 1 backend developer (Python/FastAPI) · 1–2 frontend developers (Next.js/TypeScript) · 1–2 mobile developers (Flutter/Dart — a distinct skillset from the web team, not an overlapping one) · 1 UI/UX designer · QA (part-time is fine pre-launch)

## 8. Key risks & mitigations

- **Cold start (empty directory):** seed with public clinic data; let clinics claim listings rather than requiring them to build from scratch
- **Data trust:** verification step (business permit/license) before a "verified" badge is granted
- **Hours going stale again:** last-confirmed timestamp + periodic reminders to clinics + user-reported corrections, not a one-time data entry
- **Two-sided marketplace bootstrapping:** consider manually onboarding clinics in one city/region first rather than launching everywhere at once
