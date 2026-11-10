# Product

<!-- impeccable:product-schema 1 -->

> Summary for design tools (Impeccable). **The source of truth is `AI_DOCS/`**: [PRD.md](AI_DOCS/PRD.md) for product, [DESIGN.md](AI_DOCS/DESIGN.md) for UX and design. If this file and `AI_DOCS/` disagree, `AI_DOCS/` wins: fix this file to match.

## Platform

web

Mobile-first responsive web (Next.js, `apps/web`). A native app is planned for Phase 2 and will reuse the same patterns and tokens (DESIGN.md §5).

## Users

See PRD §3 and DESIGN.md §3.

- **Pet owners** in Angeles City / Mabalacat / Clark, on mid-range Android phones over mobile data. They're either in a hurry (a sick pet, maybe at night, one hand, poor signal), planning (comparing clinics for *kapon* or vaccination), or owners of exotic pets that most clinics won't treat. No account needed.
- **Clinic staff and owners**: receptionists updating hours between patients on a phone, and vets deciding whether PAW is worth it. They aren't tech users.
- **PAW ops**: the founder, entering seed data in bulk on a laptop (`/admin`).

## Product Purpose

A pet-care discovery platform for the Philippines (vets only at launch). Owners find a clinic that offers the service they need, treats their species and is open now, then contact it in one tap. Clinics with no website get a search-engine-indexed page they keep up to date themselves. Success: complete coverage of the launch area, hours confirmed recently, and contact actions (calls, Messenger, directions). See PRD §1, §2 and §6.

## Positioning

Pet-specific search for services, species and open-now, backed by visibly confirmed hours, plus free indexed pages that clinics with no website keep up themselves.

## Operating Context

- Owners arrive from Google search or from links shared on Facebook and Messenger. They act by phone call, Messenger, Viber, or Google Maps / Waze directions (PRD §5 principle 4, DESIGN.md UX9).
- Clinics are signed up in person during visits, and are reminded monthly by SMS or email to confirm their hours with one tap (PRD §7.2, §9).
- Pages: search-first home, results (list ⇄ map), clinic page, emergency view, city/service landing pages, clinic dashboard, ops admin (DESIGN.md §4–§5).

## Capabilities and Constraints

- Phase 1 scope and phase tags are in PRD §7; the build order is in `AI_DOCS/ROADMAP.md`.
- English UI at launch, written plainly. Search understands Filipino terms (*kapon*, *bakuna*, *purga*). Every string goes through next-intl, so Filipino can be added later (DESIGN.md UX15).
- Hours have an open status, a freshness date ("confirmed N days ago by the clinic / by PAW") and an "unknown" state; their rules are DESIGN.md UX4, UX5 and UX17.
- Prices are integer centavos, shown as ranges ("₱500–₱800", "From ₱500", "Call for price").
- Performance budget (DESIGN.md §9): LCP ≤ 2.5 s and INP ≤ 200 ms on mid-range Android over throttled 4G; minimal client JS; the map loads only when asked for.
- No dark mode at launch (UX16). No bottom tab bar in Phase 1 (UX18).
- Code says `business`, never `clinic`; "clinic" is UI copy for the vet type.

## Brand Commitments

- **Working name "PAW" with a placeholder brand** (DESIGN.md §7.1): teal primary, system font, text wordmark plus the lucide `PawPrint` icon. **It is binding until the brand kit (P0-D3) replaces it.** Design work stays inside the tokens in `apps/web/src/app/globals.css`. It may flag contrast or hierarchy problems, but it doesn't propose new palettes, fonts or logos.
- Brand direction for the future kit: warm, friendly, trustworthy; clean like a good clinic, not childish or cartoonish. It should reassure a worried owner at 9 PM and look professional to a vet (DESIGN.md §7).
- **Voice: a calm, plain neighbor** (DESIGN.md §2.1). Short, warm, direct English. Reassuring, never cute: no pet puns or emoji, no hype, no exclamation marks in status or error text. Emergency copy is facts and actions only.

## Evidence on Hand

- No real clinics, users, testimonials, statistics or partner logos exist yet. Never invent them; prototypes use fictional clinics (P0-D1).
- No photography or illustration yet; the brand kit will set the image direction.
- Pitch kits (`AI_DOCS/pitch/`) list the features that can be promised, and mark the rest "Coming later", without dates.

## Product Principles

From PRD §5 and DESIGN.md §2:

1. **"Can I go there now?" in 3 seconds.** Open status, distance and a way to call are visible without scrolling or tapping.
2. **Honest data.** Freshness and its source are always visible; unconfirmed data never looks confirmed; "Sponsored" is always labeled.
3. **Useful without login**, and light on data and battery on a mid-range Android.
4. **Calm in emergencies.** The emergency flow keeps only open-now, distance and **Call**.
5. **Low effort for clinics.** Forgiving tools with big controls, previews and no dead ends; keeping a listing current takes under a minute a month.

## Accessibility & Inclusion

WCAG 2.2 AA (DESIGN.md §10): AA contrast, status never shown by color alone, tap targets ≥ 44×44 px, full keyboard support with visible focus, visible labels, alt text required on photos, reduced motion respected. Body text ≥ 16 px. Copy must be easy for Taglish readers.
