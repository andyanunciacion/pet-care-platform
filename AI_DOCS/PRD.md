# PAW — Product Requirements

> **What** we're building and **why**. For *how*, see [ARCHITECTURE.md](ARCHITECTURE.md). For *order and progress*, see [ROADMAP.md](ROADMAP.md).
> Working name: **PAW**. Final brand and domain are still undecided (see §12).

## 1. Summary

PAW is a pet-care discovery platform for the Philippines, starting in **Angeles City and nearby Region 3 areas**. It helps pet owners find the right vet clinic or pet service and see accurate hours, services, and prices. It also gives clinics that have no website a professional, search-engine-indexed web presence they can keep up to date themselves.

## 2. Problems

| # | Problem | How PAW solves it |
|---|---|---|
| P1 | The only way to find a vet is Google Maps | Search built for pets (by service, species, open now, emergency) and SEO-indexed clinic pages, so PAW shows up *inside* Google search too |
| P2 | Many clinics have no website, so owners can't check what they offer before visiting | A clinic page that does the job of a website: services, price ranges, species treated, photos, and contact options |
| P3 | Owners can't find a *specific* service (e.g. spay/neuter, exotic pets, X-ray) | Search returns **services**, not just clinics, as first-class results, with species and category filters |
| P4 | Listed clinic hours are often wrong, and owners get turned away | Structured hours with exceptions, a visible **"hours last confirmed"** date, periodic confirmation nudges to clinics, and a "report incorrect info" button |

## 3. Users

| Persona | Needs | Account? |
|---|---|---|
| **Pet owner** | Find a nearby clinic that offers the service they need, is open now, and treats their species. Contact it in one tap. | Not needed to browse. Optional from Phase 2 for pets, favorites, bookings, and reviews |
| **Clinic owner / vet** | A free web presence, fewer wasted calls and walk-ins, more clients. Low effort to keep up to date. | Yes (after claiming a listing) |
| **Clinic staff** (receptionist) | Update hours and handle requests and inquiries | Yes, invited by the clinic owner (Phase 2) |
| **Groomer / boarding / pet shop** | Same as clinics, for their services and products | **Not at launch.** Launch is vets only (vet clinics' own grooming/boarding services are listed from P1). Standalone groomers/boarding are planned for P2 and pet shops for P3. The data model is ready (ARCHITECTURE §5.3) |
| **PAW operations (super admin)** — the founder | Seed listings, verify claims, fix data, watch quality metrics | Yes |

## 4. Launch market

- **Beachhead:** Angeles City, Mabalacat City, and Clark Freeport Zone.
- **Next:** City of San Fernando and the rest of Pampanga, then Tarlac City and other Region 3 cities.
- **Rule:** reach good coverage (practically every clinic listed, with correct hours) in one area before expanding. A directory is only trusted if it's complete.

## 5. Product principles

1. **Useful without logging in.** Search, clinic pages, and contact buttons never require an account.
2. **Freshness is visible.** Every listing shows when its info was last confirmed, and by whom (the clinic or PAW).
3. **Mobile-first and light.** Most users will be on phones with mobile data. Target fast loads on mid-range Android.
4. **Meet people where they already are.** Contact through a phone call, Messenger, or Viber, and get directions through Google Maps or Waze. Don't force new habits.
5. **Trust over volume.** Verified badges, honest data sources, and "Sponsored" labels on anything paid.
6. **Low effort for clinics.** Keeping a listing accurate should take less than a minute a month.

## 6. Goals and success metrics

Targets are starting guesses. Refine them after the Phase 0 interviews.

| Metric | Why it matters | Phase 1 target (proposed) |
|---|---|---|
| Listing coverage in launch area | Completeness = trust | ≥ 90% of known clinics listed |
| % of listings with hours confirmed in the last 60 days | Directly measures P4 | ≥ 70% |
| % of listings claimed by the clinic | Supply-side adoption | ≥ 25% within 3 months of launch |
| Monthly search sessions | Owner demand | Track, no target yet |
| Contact actions (call / Messenger / directions clicks) | The real "value delivered" event, and the core of the pitch to clinics | Track, no target yet |
| Zero-result search rate | Shows missing supply or a search-quality problem | < 10% |

## 7. Feature requirements

Phase tags: **[P1]** Directory MVP · **[P2]** Accounts & engagement · **[P3]** Monetization & commerce · **[P4]** Scale & retention.

### 7.1 Pet owner — public web (and mobile app from P2)

**Search & discovery**
- [P1] One search box that returns clinics **and** services, ranked by relevance and distance.
- [P1] Filters: species treated, service category, **open now**, **emergency / 24-hour**, distance.
- [P1] Understands common Filipino terms, e.g. *kapon* → spay/neuter, *bakuna* → vaccination, *purga* → deworming.
- [P1] Map view with the list and map in sync. Uses the device location, with a city/barangay picker as a fallback.
- [P1] Zero-result searches show nearby alternatives and are logged for PAW ops.

**Clinic page**
- [P1] Name, photos, verified badge, business type, branches.
- [P1] Per branch: address, map, hours (including lunch breaks and holiday exceptions), an **open now / closes at** status, and "hours last confirmed on {date} by {clinic|PAW}".
- [P1] Services with **price ranges** (or "call for price") and the species each one covers.
- [P1] Product listings, read-only (name, photo, price, availability). No cart.
- [P1] One-tap contact: call, Messenger, Viber, email. Directions deep links to Google Maps and Waze.
- [P1] "Report incorrect info" (no login; bot-protected): choose a field, suggest the correction, optionally leave contact details.
- [P1] Unclaimed listings show a "Are you the owner? Claim this listing" call to action.
- [P2] Vet/staff profiles (name, photo, PRC-verified credentials).
- [P2] Reviews and ratings.

**SEO pages**
- [P1] Server-rendered, indexable clinic pages with structured data (schema.org `VeterinaryCare` / `LocalBusiness`).
- [P1] Programmatic landing pages, e.g. "Vet clinics in Angeles City", "24-hour vets in Pampanga", "Spay/neuter in Mabalacat".
- [P1] Sitemap, clean URLs, and Open Graph previews, since links will be shared a lot on Facebook and Messenger.
- [P4] Pet-care articles / blog.

**Owner account**
- [P2] Sign up / log in with phone OTP, Google, or email.
- [P2] Owner profile and **multiple pet profiles** (species, breed, age, sex, neutered, photo).
- [P2] Favorites / saved clinics.
- [P2] **Appointment requests**: pick a service, pet, and preferred time → the clinic confirms or suggests another slot → the owner is notified.
- [P2] **Inquiries**: async messages to a clinic ("Do you treat rabbits?"), with notifications on reply. Not real-time chat.
- [P2] Reminders by email/SMS, plus push once the app exists: upcoming appointments and vaccine due dates.
- [P3] Vaccination and visit history per pet (owner-entered first; clinic-entered later).
- [P3] Product reservation for in-store pickup, with status tracking.
- [P4] Loyalty / rewards.

### 7.2 Clinic / business dashboard

- [P1] **Claim a listing**: verify the listed phone number (code sent by SMS or call), provide the PRC license number of the vet in charge, and upload a business/Mayor's permit → PAW reviews → Verified.
- [P1] Business profile: name, description, logo, photos, business type(s), species treated.
- [P1] **Branches**: address, map pin, contact channels, emergency / 24-hour flags. Branch-first from day 1, even if most clinics have one.
- [P1] **Hours**: weekly schedule with multiple intervals per day (lunch breaks), overnight intervals, and date exceptions (holidays, closures). A one-tap **"Closed today"** button with an optional note for sudden closures (the vet is sick, a power outage).
- [P1] **Hours confirmation**: a monthly SMS/email nudge with a one-tap "still correct" link. Stale listings are flagged publicly.
- [P1] Services (category, name, species, price range, notes) and simple products (no stock counts).
- [P1] Review and accept or reject "incorrect info" reports about their own listing.
- [P1] Monthly email report: profile views, contact clicks, top searches that led to them. This is the main reason for clinics to stay engaged.
- [P2] Team: invite staff with roles (owner / manager / staff).
- [P2] Inbox for appointment requests and inquiries, with statuses (new → confirmed/declined → completed / no-show).
- [P2] In-dashboard analytics.
- [P3] Paid plan management and featured placement purchase.
- [P3] Product reservations management.
- [P4] Multi-branch management at scale (bulk edits, branch-scoped staff).

### 7.3 PAW operations — super admin

- [P1] Listing management: create/edit any business or branch, bulk CSV import, duplicate detection, data-source tracking.
- [P1] Claim review queue (documents, PRC check, phone verification result) → approve/reject with notes.
- [P1] Correction-report queue for unclaimed listings, and escalation when a clinic doesn't respond.
- [P1] Taxonomy management: service categories, species, search synonyms.
- [P1] Stats: searches, zero-result queries, contact clicks, coverage and freshness per city.
- [P1] Audit log of admin actions.
- [P2] Review moderation queue, including the clinic's right of reply.
- [P3] Plans/billing, featured placements, dispute handling.

## 8. Non-goals (for now)

- Full e-commerce with delivery, returns, and online payment for products. P3 is reserve-and-pickup only.
- Real-time chat, telemedicine, and video consults.
- Clinic practice-management software (medical records, inventory, POS). PAW is discovery and engagement, not a clinic's back office.
- Nationwide coverage before the launch area is covered well.
- A native mobile app in Phase 1. The website must work well on phones instead.

## 9. Go-to-market and operations (Phase 0–1)

**Seeding the directory.** Build the initial list by hand, and treat each contact as a sales touchpoint:
- Use Google Maps, OpenStreetMap, and Facebook only as **lead lists**. Don't bulk-copy their data: Google's terms forbid scraping and storing Places data, and OpenStreetMap's ODbL license has attribution and share-alike obligations. Confirm details from the clinic itself (call, visit, or the clinic's own page).
- Check local sources: PVMA chapter contacts, LGU business listings, pet-owner Facebook groups.
- Record the source and confirmation date for every listing.

**Getting clinics to claim.** Pitch it as free: a verified badge, a free web page, fewer "are you open?" calls, and a monthly stats report. Leave a QR sticker/standee ("Check our hours & services on PAW") at the clinic after a visit.

**Getting pet owners.**
- SEO landing pages.
- Posts in local pet Facebook groups and pages.
- Shareable clinic links.
- Partnerships with groomers, pet shops, and rescue groups.

## 10. Monetization hypotheses (validate in Phase 0 interviews)

1. **Free listing, always.** The directory has to be complete to be useful.
2. **Pro plan for clinics (P3):** appointment-request tools, full analytics, more photos, team seats, priority support. Pricing TBD, in PHP per month.
3. **Featured placement (P3):** clearly labeled "Sponsored" slots in search and landing pages.
4. **Later:** a commission on reservations/orders, and partner offers (pet food, insurance).

Interview question to include: *"What would make this worth ₱X/month to you?"* Find out what clinics already pay for (Facebook ads, flyers).

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cold start: empty or incomplete directory | Hand-seed one area to near-100% coverage before launch |
| Clinics don't claim or update listings | PAW ops keeps unclaimed listings fresh (phone confirmations). One-tap confirmation links. Owner-reported corrections |
| Stale hours erode trust | Visible last-confirmed date, monthly nudges, auto-flag listings older than 90 days |
| Fake or incorrect claims | Phone verification + PRC license check + business permit review |
| Reviews: fake reviews and online-libel exposure (PH Cybercrime Prevention Act) | Reviews only from accounts, moderation queue, clinic right of reply, clear content policy. **Get legal advice before launching reviews (P2)** |
| Data Privacy Act (RA 10173) | Privacy notice and consent, data minimization, private storage for documents, a retention policy, and a breach procedure. Check NPC registration requirements before collecting owner data (P2) |
| Selling medicines | Out of scope. Vet drugs are regulated; get advice before any P3 product rules |
| SMS OTP abuse and cost | Bot protection, per-number and per-IP rate limits, email/Google login alternatives |
| Solo founder bandwidth | Tight scope per phase, managed services, one language (TypeScript) across the stack |

## 12. Open questions

- [ ] Brand name and domain (`.ph` vs `.com`).
- [x] Launch scope → **vets only**. Standalone groomers/boarding come later (tentatively P2), and pet shops in P3.
- [ ] UI language: English-first with the code i18n-ready. When should Filipino be added?
- [x] Build hours → flexible. The roadmap uses exit criteria, not dates.
- [ ] When to register the business (DTI/SEC, BIR, Mayor's permit). Needed before charging clinics and before a PayMongo account.
- [ ] Monthly infrastructure budget ceiling (see ARCHITECTURE §10 for estimates).
