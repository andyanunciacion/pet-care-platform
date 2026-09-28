# PAW — UX & Design

> **How PAW looks and behaves.** Product scope: [PRD.md](PRD.md). Tech: [ARCHITECTURE.md](ARCHITECTURE.md). Order: [ROADMAP.md](ROADMAP.md) (Design track).
> The UX decisions in §6 are **proposed defaults**. Test them with the prototype in Phase 0 interviews, then update this file.

## 1. How design works on PAW

We have no dedicated designer, so the approach is **prototype-first and design-in-code**:

1. **Structure.** Users, screens, navigation, and key UX decisions (this file).
2. **Clickable prototype.** Mobile-first screens that owners and clinics try during Phase 0 interviews. It's thrown away once the real pages exist.
3. **Brand kit.** Name, logo, palette, and fonts (§7). This is the one part worth paying a designer for.
4. **Design system in code.** Brand values become CSS variables that theme **shadcn/ui** + Tailwind (§8).
5. **Build and test per slice.** Every owner-facing slice gets a quick usability check with 3–5 real people on staging (§11).

Figma is optional. Inspiration screenshots go in `AI_DOCS/design/inspiration/`; Claude can read images.

## 2. UX principles

1. **"Can I go there now?" in 3 seconds.** Open status, distance, and a way to call are visible without scrolling or tapping.
2. **Mobile-first, one-handed.** Primary actions sit in the thumb zone (a sticky bottom action bar on clinic pages). Design at 360px wide first.
3. **Useful without login.** No sign-up walls or pop-ups asking to register. Location permission is optional, never blocking.
4. **Honest data.** Always show how fresh the info is and who confirmed it. Never make unconfirmed data look confirmed.
5. **Light on data and battery.** Mid-range Android on mobile data is the baseline device (§9). The map loads only when asked for.
6. **Plain words, icons with labels.** Short English copy that is friendly to Taglish readers. Icons never stand alone.
7. **Calm in emergencies.** The emergency flow removes everything except open-now, distance, and **Call**.
8. **Clinic tools are forgiving.** Receptionists aren't tech users: big controls, previews of how owners will see changes, no dead ends.

## 3. Users & contexts

| Who | Context | Designs for |
|---|---|---|
| Owner in a hurry | Pet is sick, maybe at night, one hand, poor signal | Emergency flow, open status, one-tap call |
| Owner planning | Comparing clinics for *kapon* or vaccination, on the sofa | Service search, price ranges, species filter |
| Exotic pet owner | Most clinics won't treat their rabbit, bird, or reptile | Species filter, and clear "treats rabbits" signals |
| Clinic receptionist | Updating hours between patients, on a phone | Mobile-first dashboard, hours editor, one-tap confirm page |
| Clinic owner / vet | Deciding whether PAW is worth it | "For clinics" page, their own page preview, monthly stats |
| PAW ops (founder) | Entering seed data on a laptop, in bulk | Dense, keyboard-friendly admin tables and forms |

## 4. Information architecture

```
Public (owners, indexable)
├── /                              Home: search-first
├── /search?q=&…                   Results: list ⇄ map
├── /{province}/{city}/{business}  Clinic page (branch sections if >1)
├── /{province}/{city}/vets        City landing
├── /{province}/{city}/services/{category}
├── /24-hour-vets/{city}
├── /for-clinics                   Why list / how to claim (also used in pitches)
├── /about · /privacy · /terms
└── /confirm/{token}               One-tap "hours still correct?" page (from nudge link)

/dashboard (clinic, noindex, mobile-first)       /admin (PAW ops, noindex, desktop-first)
├── Overview (freshness + stats)                 ├── Listings (table) → Listing editor
├── Profile                                      ├── CSV import
├── Branches → Hours · Services                  ├── Claims queue
├── Products · Photos                            ├── Correction reports queue
└── Correction reports                           ├── Taxonomy (categories, species, synonyms)
                                                 ├── Stats · Audit log
```

**Public navigation (P1):** a slim top bar with the logo, a compact search on inner pages, and a "For clinics" link. There's no bottom tab bar in P1 because there are too few sections. Revisit it in P2 when accounts, favorites, and pets arrive.

## 5. Screen inventory

**Phase 1 — owner-facing** (all states: loading · empty · error · offline-ish slow)

| Screen | Slice | Prototype? |
|---|---|---|
| Home: search box, quick chips (Open now · Emergency/24h · Kapon · Bakuna · species), location prompt / city picker | 5 | ✅ |
| Search results: list (default) ⇄ map toggle, filter sheet, result cards, zero-results state | 5 | ✅ |
| Clinic page: header, status, freshness, sticky contact bar, services & prices, hours, species, photos, branches, report link, claim CTA | 4 | ✅ |
| Emergency view: open-now + 24h only, sorted by distance, big Call buttons | 5 | ✅ |
| Report incorrect info (bottom sheet) | 7 | ✅ |
| City / service / 24-hour landing pages | 6 | — (reuses results layout) |
| For clinics page | 6–8 | ✅ (clinic interviews) |
| About · Privacy · Terms · 404 | 12 | — |

**Phase 1 — PAW ops (`/admin`, desktop-first):** listings table, listing editor (business → branches → hours → services → products → media), CSV import with a row-level validation preview, correction-report queue, taxonomy manager, stats, audit log. Claims queue from slice 8. Use shadcn defaults with minimal custom design.

**Phase 1 — clinic (`/dashboard`, after the validation checkpoint):** claim flow (multi-step), overview (freshness status + "Confirm hours" button + this month's stats), profile, branches, **hours editor**, services, products, photos, correction reports, and the `/confirm/{token}` page.

**Phase 2+:** sign-up/login, owner profile, pets, favorites, appointment request flow, inquiries, reviews, clinic inbox, and the mobile app, which reuses the same patterns and tokens.

## 6. Key UX decisions (proposed; validate with the prototype)

| # | Decision | Proposed default |
|---|---|---|
| UX1 | **Home** | Search-first, not a marketing page. The search box plus quick chips is the whole top of the page. Location is requested only when "near me" is needed; if it's denied, fall back to a city picker (default: Angeles City) |
| UX2 | **List vs map** | Mobile: list is the default and the map is a toggle (map lazy-loaded). Desktop: split view with list and map side by side |
| UX3 | **Result card** | Name + verified badge · open-status line · distance · species icons · a **Call** button on the card. The matched service + price range appear **only when the search matched a service** (e.g. "kapon"), not for plain clinic-name searches |
| UX4 | **Open status** | Always text + icon + color, never color alone. States: **Open · closes 6 PM** · **Closing soon** (< 60 min) · **Closed · opens 8 AM tomorrow** · **Open 24 hours** · **Closed today** (exception, e.g. holiday) · **Hours not confirmed** |
| UX5 | **Freshness** | Shown on the clinic page near the hours, and in short form on cards. Wording: "Hours confirmed 5 days ago by the clinic" (or "by PAW"). ≤ 30 days: normal. 31–90 days: "May have changed. Call ahead." > 90 days or never confirmed: a warning style, and the listing ranks lower |
| UX6 | **Unclaimed vs verified** | Unclaimed must not look broken, since most listings start that way. Show "Listed by PAW" in small text plus a subtle claim CTA at the bottom. Verified: a badge next to the name that explains itself on tap |
| UX7 | **Emergency entry** | A persistent "Emergency" chip on home and results. Tapping it opens the emergency view (open-now + 24h only, sorted by distance, big Call buttons) with a line: "Call before going" |
| UX8 | **Clinic page order** | Header (name, badge, status, freshness) → sticky bottom bar (**Call · Messenger · Directions**) → services by category with prices → hours (today highlighted, upcoming exceptions shown) → species treated → photos → other branches → "Report incorrect info" → claim CTA |
| UX9 | **Contact actions** | `tel:` link; `m.me` Messenger link; Viber link; directions open Google Maps or Waze (let the user pick once, then remember the choice in the browser). Every tap is logged as a listing event |
| UX10 | **Prices** | "₱500–₱800", "From ₱500", or "Call for price", plus the unit when it isn't per visit ("/night"). A footnote on the clinic page: "Prices are estimates. Confirm with the clinic." |
| UX11 | **Report incorrect info** | A bottom sheet: choose what's wrong (hours · phone · address · services · closed permanently · other) → optional note → send. No login, invisible Turnstile, thank-you state |
| UX12 | **Zero results** | Never a dead end. Offer to widen the radius, remove filters, or search nearby cities, and show "Emergency" if it's night time. The query is logged for ops |
| UX13 | **Hours editor** | A weekly grid with a "Closed" toggle per day, multiple intervals per day (lunch break), "copy to all weekdays", overnight shown clearly ("until 2 AM next day"), an exceptions calendar for holidays, and a live preview of how owners will see it. This is the most complex form, so prototype it for clinic interviews |
| UX14 | **Admin vs dashboard density** | `/admin`: dense tables, keyboard-friendly, desktop-first. `/dashboard`: mobile-first, one task per screen, big controls |
| UX15 | **Language** | English copy at launch, written plainly. Search understands Filipino terms (PRD §7.1). All UI strings go through an i18n layer from day 1 so Filipino can be added later (library chosen at monorepo setup) |
| UX16 | **Dark mode** | Not at launch. Tokens are structured so it can be added without refactoring |
| UX17 | **Listings with no hours data** | Show them, don't hide them; coverage matters. Status reads **"Hours unknown — call ahead"** (the `--status-unknown` style). These listings are excluded from the "Open now" and emergency results and ranked below listings with hours |
| UX18 | **Bottom tab bar** | None in P1 (see §4). Revisit in P2 when accounts, favorites, and pets add enough sections |

## 7. Brand & visual identity

**Status:** blocked on the brand name (PRD §12). Until then, the prototype and builds use the **placeholder brand** in §7.1.

### 7.1 Placeholder brand (temporary — replace with the brand kit)

> Every value here is a stand-in. Keep them all in the token file (§8) so swapping in the real brand is a one-file change. Never hard-code them in components.

| Item | Placeholder | Notes |
|---|---|---|
| Name | **PAW** | Working name used in UI copy, `<title>`, and meta tags |
| Logo | Text wordmark "PAW" in bold + lucide `PawPrint` icon in the primary color | No image file needed. Icon-only version = the `PawPrint` icon, used as the favicon |
| Font | System UI font stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) | Zero download, fastest option, and Android's Roboto includes the ₱ sign |
| Radius | `0.75rem` | Slightly rounded = friendly |

| Token | Placeholder | Tailwind equivalent | Use |
|---|---|---|---|
| `--primary` | `#0F766E` | teal-700 | Buttons, links, logo (health + trust) |
| `--primary-foreground` | `#FFFFFF` | white | Text on primary |
| `--accent` | `#FEF3C7` | amber-100 | Warm highlight backgrounds only (not text) |
| `--background` | `#FFFFFF` | white | Page |
| `--foreground` | `#0F172A` | slate-900 | Body text |
| `--muted-foreground` | `#64748B` | slate-500 | Secondary text |
| `--border` | `#E2E8F0` | slate-200 | Borders, dividers |
| `--status-open` | `#15803D` | green-700 | "Open" |
| `--status-closing` | `#B45309` | amber-700 | "Closing soon" |
| `--status-closed` | `#B91C1C` | red-700 | "Closed" |
| `--status-unknown` | `#64748B` | slate-500 | "Hours unknown / not confirmed" |
| `--stale` | `#B45309` | amber-700 | Freshness warnings |
| `--verified` | `#2563EB` | blue-600 | Verified badge |
| `--emergency` | `#DC2626` | red-600 | Emergency chip and view |

All text colors above meet WCAG AA contrast (≥ 4.5:1) on white. Re-check this when the real palette arrives. Values will be converted to shadcn's color format (OKLCH) at setup.

**Brand kit deliverables:**
- Logo: SVG, full + icon-only, light and dark background versions
- Favicon / app icon (for the P2 mobile app too)
- Color palette: primary, accent, neutrals, plus the status colors in §8
- Typography: one font family (two at most), free for web use, with good support for ₱ and Filipino text
- Photo/illustration direction and a few example images

**Direction:** warm, friendly, trustworthy. Clean like a good clinic, not childish or cartoonish. It should reassure a worried owner at 9 PM and look professional to a vet.

**How to get it:**
- **(Recommended)** Hire a freelance designer for a one-off brand kit. Give them this section plus the PRD summary.
- Or do it yourself with Claude: pick a font and palette, and use a text logo until later.

## 8. Design tokens & components

**Tokens** are CSS variables in `apps/web`, following shadcn/ui's naming so every component themes automatically:
- **shadcn base:** `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`.
- **PAW semantic tokens:** `--status-open`, `--status-closing`, `--status-closed`, `--status-unknown`, `--verified`, `--emergency`, `--stale`.
- Components use tokens, never raw hex values. Changing the brand = editing one file.

**Other foundations:**
- **Type:** the brand font is self-hosted via `next/font` (no layout shift, no Google request at runtime). Minimum body text is 16px.
- **Icons:** lucide (shadcn's default). Species icons may need a small custom set.

**PAW components** (built on shadcn primitives, living in `apps/web/components` until there's a reason to share them):
- **Search:** `SearchBar`, `QuickChips`, `FilterSheet`, `ResultCard`, `MapView` (lazy), `EmptyState`
- **Clinic info:** `OpenStatus`, `FreshnessNote`, `VerifiedBadge`, `PriceRange`, `SpeciesIcons`, `HoursTable`
- **Actions & forms:** `ContactBar`, `ReportSheet`, `ClaimCTA`, `HoursEditor`

## 9. Performance budget (public pages)

| Metric | Target | Tested on |
|---|---|---|
| Largest Contentful Paint | ≤ 2.5 s | Mid-range Android, throttled 4G |
| Interaction to Next Paint | ≤ 200 ms | same |
| Cumulative Layout Shift | ≤ 0.1 | same |
| Lighthouse mobile performance | ≥ 90 on clinic and landing pages | CI check from slice 4 |

- Clinic and landing pages are server-rendered and use as little client JavaScript as possible. Set a JS size budget in slice 4.
- The map library loads only when the map view opens.
- Images use `next/image` with responsive sizes, modern formats, and lazy loading below the fold.

## 10. Accessibility (WCAG 2.2 AA)

- Color contrast is AA or better. Status is never shown by color alone (UX4).
- Tap targets are at least 44×44px, with enough spacing between adjacent buttons.
- Everything works by keyboard, with visible focus rings (shadcn/Radix provide most of this).
- Form fields have visible labels, not placeholder-only, and errors in plain words.
- Photos have alt text (the `media.alt` field is required in the editors).
- Respect reduced-motion settings; animations are minimal anyway.

## 11. Testing the UX

- **Phase 0:** owners and clinics use the clickable prototype during interviews. Record what they tried, where they hesitated, and what they said in the interview notes template (pitch kits §10).
- **Each owner-facing slice:** a 3–5 person check on staging using the journeys in `pitch/pet-owners.md` §6 as tasks ("Find a clinic that can spay your cat this Saturday"). Fix the top issues before moving on.
- **Before launch:** run the full journeys on a real mid-range Android over mobile data.

## 12. Design questions

Decided with defaults for now. Revisit any of them if the prototype tests say otherwise.

- [ ] Brand name → brand kit (§7). **Open.** Placeholder brand in use (§7.1).
- [x] Price ranges on result cards → only for service searches (UX3).
- [x] Directions → ask Google Maps vs Waze once, then remember the choice (UX9).
- [x] Bottom tab bar → none in P1; revisit in P2 (UX18).
- [x] Listings with no hours data → shown as "Hours unknown — call ahead", excluded from open-now results, ranked lower (UX17).
