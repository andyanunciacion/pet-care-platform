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

Claude reviews and polishes UI with **Impeccable**, a design plugin for Claude Code (ARCHITECTURE D40; the commands to use are in CLAUDE.md). It reads the root `PRODUCT.md` and `DESIGN.md`, which are short summaries of this file and the PRD. Decisions are made here and the summaries follow: after changing this file or the tokens, update them (`/impeccable document` refreshes the root `DESIGN.md` and `.impeccable/design.json`).

## 2. UX principles

1. **"Can I go there now?" in 3 seconds.** Open status, distance, and a way to call are visible without scrolling or tapping.
2. **Mobile-first, one-handed.** Primary actions sit in the thumb zone (a sticky bottom action bar on clinic pages). Design at 360px wide first.
3. **Useful without login.** No sign-up walls or pop-ups asking to register. Location permission is optional, never blocking.
4. **Honest data.** Always show how fresh the info is and who confirmed it. Never make unconfirmed data look confirmed.
5. **Light on data and battery.** Mid-range Android on mobile data is the baseline device (§9). The map loads only when asked for.
6. **Plain words, icons with labels.** Short English copy that is friendly to Taglish readers. Icons never stand alone.
7. **Calm in emergencies.** The emergency flow removes everything except the status (open now, or "call for emergencies"), distance, and **Call**.
8. **Clinic tools are forgiving.** Receptionists aren't tech users: big controls, previews of how owners will see changes, no dead ends.
9. **Actions look like actions.** Anything that can be tapped must look tappable at a glance, without hovering: a button shape or an underlined/arrowed link, with a verb label ("Call", "View branch"). Text that only *looks* like a link (colored, but not tappable) and links that only look like text are both bugs. Rules in §8 ("Making actions obvious").

### 2.1 Voice & tone

PAW sounds like **a calm, plain neighbor** who already called around and tells you straight.

- **Short, warm, direct English.** Everyday words a Taglish reader knows; no idioms or slang. Use the Filipino terms owners search with (*kapon*, *bakuna*, *purga*) next to the English name where it helps.
- **Reassuring, never cute.** No pet puns, no emoji, no hype ("best", "amazing", "#1"). No exclamation marks in status, error or emergency text.
- **Say what's true, then what to do.** "Hours unknown. Call before you go." "May have changed. Call ahead." Never make a guess sound confirmed (principle 4).
- **Emergencies: facts and actions only.** "Open 24 hours · 2.1 km · Call". "Call before going." No reassurance padding.
- **Errors in plain words:** what happened and what to do next, never blaming the user ("We couldn't send your report. Check your signal and try again.").
- **To clinics:** respectful and practical; talk about "your page" and what owners see, not features or jargon.
- **Formats:** times as "6 PM", "8 AM tomorrow"; prices as "₱500–₱800", "From ₱500", "Call for price" (UX10).

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
├── /{province}/{city}/{business}  Clinic page (1 branch), or its list of branches (2+)
│   └── /{branch}                  Each branch's clinic page, in its own city (2+ branches)
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
| Emergency view: open now (incl. 24h) by distance, then branches that take emergency calls while closed; big Call buttons | 5 | ✅ |
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
| UX4 | **Open status** | Always text + icon + color, never color alone. States: **Open · closes 6 PM** · **Closing soon** (< 60 min) · **Closed · opens 8 AM tomorrow** · **Open 24 hours** · **Closed today** (the clinic or PAW marked today closed: holiday, sick day; shows their note) · **Hours unknown**, with how to check first on the next line (no hours data, UX17). "Closed today" wins over "Hours unknown": an explicit closure is real information. Whether hours were ever *confirmed* is shown separately (UX5) |
| UX5 | **Freshness** | Shown on the clinic page near the hours, and in short form on cards. Wording: "Hours confirmed 5 days ago by the clinic" (or "by PAW"). ≤ 30 days: normal. 31–90 days: "May have changed. Call ahead." > 90 days or never confirmed: a warning style, and the listing ranks lower |
| UX6 | **Unclaimed vs verified** | Unclaimed must not look broken, since most listings start that way. Show "Listed by PAW" in small text plus a subtle claim CTA at the bottom. Verified: a badge next to the name that explains itself on tap |
| UX7 | **Emergency entry** | A persistent "Emergency" chip on home and results. Tapping it opens the emergency view with a line: "Call before going". It lists the branches **open now** (24-hour ones included), nearest first, then the ones that are closed (or whose hours are unknown) but **accept emergencies and have a phone number** (UX19), labeled "Closed now · call for emergencies". Big Call buttons (ARCHITECTURE §6, D45) |
| UX8 | **Clinic page order** | Header (logo beside the name when there is one, name at the headline size so the status card stays above the fold, address, **species treated** as one row, "Treats" + a pill per animal (also on branch cards), the verified badge, then the status card: the status at the largest size in it, the emergency line, freshness, and on mobile a "See all hours" link to the hours section; an unclaimed listing's "Listed by PAW" comes after the card, since it matters less than the status) → sticky bottom bar (**Call · Messenger · Directions**) → services by category with prices (each group under a sentence-case heading on a `muted` band) → **products** (the business's, read-only: thumbnail when there's an image, price or "Ask for price", availability in words) → hours (today highlighted, upcoming exceptions shown) → photos (a sideways **swipe strip**: about 85% of the width per photo on phones and about 3¼ across from tablet width, so the next one always peeks in, CSS scroll snapping; tapping a photo enlarges it in a full-screen view with its caption and Close, also closed by Esc or a tap outside, built on the browser's Popover API so there's still no client JavaScript and the large file only loads when opened; no previous/next inside the view) → other branches → "Report incorrect info" → claim CTA. On desktop, hours, contacts and address sit in a right-hand panel beside services and products with a hairline border (white, not tinted), so they read as one block apart from the services; on mobile they stack without a panel. A business with several branches has a short list page (each branch with its status and **Call**) and one full page per branch. A permanently closed listing shows "Permanently closed" instead of the status, and no contact bar. Built in slice 4 without the report link (slice 7) and the claim CTA (`/for-clinics` in slice 6, the claim flow in slice 8) |
| UX9 | **Contact actions** | `tel:` link; `m.me` Messenger link; Viber link; directions open Google Maps or Waze (let the user pick once, then remember the choice in the browser). Every tap is logged as a listing event. The contact bar fits a 360px phone in one row: the primary button gets the most room, and below tablet width the secondary ones stack their icon over a smaller label (never icon-only). It always has one primary button: **Call** (with the number from tablet width up, "Call 0917 123 4567", since a shared link is often opened on a computer), or Messenger when there's no phone, or Directions when there's neither. Call dials the branch's first phone number |
| UX10 | **Prices** | "₱500–₱800", "From ₱500", or "Call for price", plus the unit when it isn't per visit ("/night"). A footnote on the clinic page: "Prices are estimates. Confirm with the clinic." |
| UX11 | **Report incorrect info** | A bottom sheet: choose what's wrong (hours · phone · address · services · closed permanently · other) → optional note → send. No login, invisible Turnstile, thank-you state |
| UX12 | **Zero results** | Never a dead end. Offer to widen the radius, remove filters, or search nearby cities, and show "Emergency" if it's night time. The query is logged for ops |
| UX13 | **Hours editor** | A weekly grid with a "Closed" toggle per day, multiple intervals per day (lunch break), "copy to all weekdays", overnight shown clearly ("until 2 AM next day"), a list of upcoming exceptions (holidays, special hours) added with a date picker, a one-tap **"Closed today"** action with an optional note (for sudden closures: sick vet, power outage; also on the dashboard overview), and a live preview of how owners will see it. This is the most complex form, so prototype it for clinic interviews |
| UX14 | **Admin vs dashboard density** | `/admin`: dense tables, keyboard-friendly, desktop-first. `/dashboard`: mobile-first, one task per screen, big controls |
| UX15 | **Language** | English copy at launch, written plainly. Search understands Filipino terms (PRD §7.1). All UI strings go through an i18n layer from day 1 so Filipino can be added later (**next-intl**, strings in `apps/web/messages/en.json`; no locale in URLs yet) |
| UX16 | **Dark mode** | Not at launch. Tokens are structured so it can be added without refactoring |
| UX17 | **Listings with no hours data** | Show them, don't hide them; coverage matters. Status reads **"Hours unknown"** (the `--status-unknown` style) with what to do on the next line in body text, since that's the useful part: "Call before you go.", "Message before you go." without a phone, or "There's no phone or Messenger listed to check first." with neither. The page never tells owners to call a branch they can't call: without a phone, "Call for price" reads "Ask for price", and the products footnote and the no-services line say to message or ask when visiting. These listings are excluded from the "Open now" results, appear in emergency results only when they accept emergencies and have a phone (UX7, UX19), and rank below listings with hours |
| UX18 | **Bottom tab bar** | None in P1 (see §4). Revisit in P2 when accounts, favorites, and pets add enough sections |
| UX19 | **"Accepts emergencies"** | The flag promises that owners **can call the branch about an emergency even when it's closed** (by phone, not necessarily a walk-in). The clinic page says "Takes emergencies" while open and "Closed now · call for emergencies" when closed ("Call for emergencies" when hours are unknown), in normal text with a neutral icon, in bold when closed or unknown (then it's the one thing to act on). A branch with the flag but no phone number shows no emergency line: the promise is a phone call: emergency red is only for the Emergency chip and view (UX7). Confirm the wording in clinic interviews (it's what a clinic agrees to when the flag is set) |
| UX20 | **Time on cached pages** | Public pages are cached and can be days old when served (ARCHITECTURE D41), so the HTML never states anything that depends on the current time. Before the browser takes over it shows the named day's hours ("Thursday: 8 AM – 5 PM"), the confirmation date ("Hours confirmed Nov 6, 2026 by PAW") and no "Today" row; then the browser shows the open status, "5 days ago" and today's row |
| UX21 | **Species filter on the clinic page** (planned, not built) | Species treated sit in the header (UX8) because they decide whether the rest of the page matters; branch cards show them too. A filter of species chips above the services ("Cat" shows only what covers cats, with its price) is planned, with these rules: **shown only when it helps** (the branch treats 2+ species, lists about 8+ services, and some services name a species); **services with no species stay visible under every filter** (most imported services have none: they read as "ask the clinic"); **no `?species=` in the URL** (it would make the cached page render per request, ARCHITECTURE D41): chips are a small client component or CSS-only (`:has()`); arriving from a species search ("vet for rabbits") preselects that species. Build it with P1-5b (the search preselect is its strongest use) or once real clinics have species on their services, and check in the 3–5 person usability test whether owners look for it |

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

All text colors above meet WCAG AA contrast (≥ 4.5:1) on white (lowest: slate-500 at 4.76:1). **On the `muted` surface (slate-100) they don't:** `muted-foreground` / `status-unknown` reach 4.34:1 and `emergency` 4.41:1. Status lines, freshness and secondary text therefore sit on white (cards get a border instead of a tint), and anything on a `muted` or `accent` tint uses `foreground`. Re-check this when the real palette arrives. The values live, converted to OKLCH (shadcn's color format), in `apps/web/src/app/globals.css`.

**Brand kit deliverables:**
- Logo: SVG, full + icon-only, light and dark background versions
- Favicon / app icon (for the P2 mobile app too)
- Color palette: primary, accent, neutrals, plus the status colors in §8
- Typography: one font family (two at most), free for web use, with good support for ₱ and Filipino text
- Photo/illustration direction and a few example images

**Direction:** warm, friendly, trustworthy. Clean like a good clinic, not childish or cartoonish. It should reassure a worried owner at 9 PM and look professional to a vet.

- **North star: "The Neighbor Who Knows".** The local who already called around and knows which clinic is open, which one sees rabbits, and roughly what a *kapon* costs. Warm and local, but every fact is exact and dated.
- **Components are soft and friendly:** generous rounding (the radius token), tinted `muted` / `accent` surfaces to group and highlight content, and depth from tint before shadow. Shadows only on things that float (bottom sheets, popovers, the sticky contact bar). Friendliness comes from shape, tint and words, never from mascots or cartoons.
- These hold for the placeholder brand too. Until the brand kit lands, design work stays inside the §7.1 tokens and doesn't propose new palettes, fonts or logos.

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
- **Control size:** shadcn's default buttons and inputs are 32–36px tall, which suits `/admin`'s density only. Owner pages and `/dashboard` use controls at least 44px tall (§10), with 16px text in inputs (which also stops iOS zooming in on focus).

**Making actions obvious** (principle 9; owner pages and `/dashboard`, not `/admin`):
- **Buttons for actions, at least 44px tall, with a verb label** and an icon where it helps. Primary (`bg-primary`) for the one main action in a group, outline (border, `text-primary`) for the others. Never an icon alone.
- **Text links say where they go:** underlined, or followed by an arrow (`ChevronRight`), in `text-primary`. `text-primary` is kept for things that can be tapped: headings and plain text never use it.
- **A card that opens something shows its action as a visible button** ("View branch ›"), lined up with the card's other buttons. Only the buttons are tappable, not the whole card: one obvious target per action, and no hidden tap areas. The card's border may turn `primary` on hover to show which item the buttons belong to. Its heading is plain text, not a link. Reference: `BranchSummary` in `components/listing/sections.tsx`.
- **Line up repeated actions:** cards in a row have their buttons at the bottom (`mt-auto`), in the same order (Call, then View).
- **Every tappable thing has hover and press feedback**, plus the global focus ring. Primary buttons darken on hover (darker, never lighter, so white text keeps its contrast); outline buttons tint `muted` and their border turns `primary`; cards turn their border `primary`; text links thicken their underline. Buttons press down 1px when tapped. Transitions are short (150 ms) and off under reduced motion. Hover only adds: the resting state must already look tappable, since phones have no hover. The owner-page button styles live in `apps/web/src/lib/action-styles.ts` (`primaryAction`, `outlineAction`); use them instead of new ones.
- **Repeated buttons name their target for screen readers:** "Call" + a visually hidden branch name ("Call Balibago").

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
| JavaScript transferred | ≤ 205 KB (gzip) on a clinic page | same |

- Clinic and landing pages are server-rendered and use as little client JavaScript as possible. The JS budget was set in slice 4 at the clinic page's size then (177 KB, mostly React and Next) plus ~15% headroom: a new client library on owner pages has to fit in it, or the budget is raised on purpose in this table.
- **How it's checked:** `pnpm lighthouse` (and the `lighthouse` CI job) runs Lighthouse 3 times on a fixture clinic page with photos, logo and products, in Lighthouse's mobile preset (simulated mid-range phone, 4G), and fails if the median misses LCP, CLS, performance or the JS budget (ARCHITECTURE D44). INP needs real interactions, so it's checked on a real phone in the usability tests (§11). At slice 4: performance 100, LCP ~0.8 s, CLS 0.
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
- [x] Listings with no hours data → shown as "Hours unknown" with how to check first, excluded from open-now results, ranked lower (UX17).
