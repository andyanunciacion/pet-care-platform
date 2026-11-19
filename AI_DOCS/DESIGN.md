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

PAW sounds like **a caring, plain neighbor** who already called around, tells you straight, and cares how your pet is doing.

- **Short, warm, direct English.** Everyday words a Taglish reader knows; no idioms or slang. Use the Filipino terms owners search with (*kapon*, *bakuna*, *purga*) next to the English name where it helps.
- **Caring and warm, never cute** (warmer since 2026-11-19, §7). Copy speaks to the owner as someone who loves their pet: "Let's find a vet near you", "We hope they feel better soon", "Your page helps owners find you". Still no pet puns, no emoji, no hype ("best", "amazing", "#1"). No exclamation marks in status, error or emergency text.
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
├── /search?q=&…                   Results: list ⇄ map (noindex)
├── /emergency                     Emergency view (UX7)
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
| Home: search box, quick chips (Open now · Emergency), location line / city picker; below it the sections of UX22 (emergency band, open now, needs, animals, trust stamp, booklet illustration) | 5 | ✅ |
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
| UX1 | **Home** | Search-first, not a marketing page. The search box plus quick chips is the whole top of the page. Under the box, a location line: "In Angeles City · Change" or "Near you"; Change opens **Use my location** and a city picker (the cities with listings, plus "All areas"). Location is requested only when "near me" is needed (tapping Use my location, or searching while near me is the remembered choice); if it's refused or times out, the line says so in plain words and switches to the city picker (default: Angeles City). The browser remembers which kind of location was chosen, never the position (ARCHITECTURE D46). Quick chips: Open now · Emergency · Kapon (spay / neuter) · Bakuna (vaccines) · the 3 most common animals (dog, cat, rabbit); the other animals are in the results page's filters. The results page has the same search box and location line (no chips), a **Filters** button that opens a bottom sheet (animal, service, "only clinics open now"), the Emergency chip, and the filters in use as removable chips ("Rabbit ×") |
| UX2 | **List vs map** | Mobile: list is the default and the map is a toggle (map lazy-loaded). Desktop: split view with list and map side by side |
| UX3 | **Result card** | Name + verified badge · open-status line · distance · species icons · a **Call** button on the card. The matched service + price range appear **only when the search matched a service** (e.g. "kapon"), not for plain clinic-name searches |
| UX4 | **Open status** | Always text + icon + color, never color alone. States: **Open · closes 6 PM** · **Closing soon** (< 60 min) · **Closed · opens 8 AM tomorrow** · **Open 24 hours** · **Closed today** (the clinic or PAW marked today closed: holiday, sick day; shows their note) · **Hours unknown**, with how to check first on the next line (no hours data, UX17). "Closed today" wins over "Hours unknown": an explicit closure is real information. Whether hours were ever *confirmed* is shown separately (UX5) |
| UX5 | **Freshness** | Shown on the clinic page near the hours, and in short form on cards. On the clinic page it's the dated confirmation stamp (§7.1): "Hours confirmed · Nov 6, 2026 · by the clinic" (or "by PAW"), then "Confirmed 5 days ago." once the browser knows the time. Short form on cards: "Hours confirmed 5 days ago by the clinic". ≤ 30 days: normal. 31–90 days: "May have changed. Call ahead." > 90 days or never confirmed: a warning style, and the listing ranks lower |
| UX6 | **Unclaimed vs verified** | Unclaimed must not look broken, since most listings start that way. Show "Listed by PAW" in small text plus a subtle claim CTA at the bottom. Verified: a badge next to the name that explains itself on tap |
| UX7 | **Emergency entry** | A persistent "Emergency" chip on home and results. Tapping it opens the emergency view with a line: "Call before going". It lists the branches **open now** (24-hour ones included), nearest first, then the ones that are closed (or whose hours are unknown) but **accept emergencies and have a phone number** (UX19), labeled "Closed now · call for emergencies". Big Call buttons (ARCHITECTURE §6, D45) |
| UX8 | **Clinic page order** | Header (logo beside the name when there is one, name at the headline size on a ruled line so the status card stays above the fold, address under the rule, **species treated** as one row, "Treats" + a sticker label per animal (also on branch cards), the verified badge, then the status card on a `page` tint: the status at the largest size in it, the emergency line, then under a ruled line the confirmation stamp and, on mobile, a "See all hours" link to the hours section; an unclaimed listing's "Listed by PAW" comes after the card, since it matters less than the status) → sticky bottom bar (**Call · Messenger · Directions**) → services by category with prices (each group under an uppercase entry label on a `binding` rule, rows on white, §7.1) → **products** (the business's, read-only: thumbnail when there's an image, price or "Ask for price", availability in words) → hours (today highlighted, upcoming exceptions shown) → photos (a sideways **swipe strip**: about 85% of the width per photo on phones and about 3¼ across from tablet width, so the next one always peeks in, CSS scroll snapping; tapping a photo enlarges it in a full-screen view with its caption and Close, also closed by Esc or a tap outside, built on the browser's Popover API so there's still no client JavaScript and the large file only loads when opened; no previous/next inside the view) → other branches → "Report incorrect info" → claim CTA. On desktop, hours, contacts and address sit in a right-hand panel beside services and products with a 2px border (white, not tinted), so they read as one block apart from the services; on mobile they stack without a panel. A business with several branches has a short list page (each branch with its status and **Call**) and one full page per branch. A permanently closed listing shows "Permanently closed" instead of the status, and no contact bar. Built in slice 4 without the report link (slice 7) and the claim CTA (`/for-clinics` in slice 6, the claim flow in slice 8) |
| UX9 | **Contact actions** | `tel:` link; `m.me` Messenger link; Viber link; directions open Google Maps or Waze (let the user pick once, then remember the choice in the browser). Every tap is logged as a listing event. The contact bar fits a 360px phone in one row: the primary button gets the most room, and below tablet width the secondary ones stack their icon over a smaller label (never icon-only). It always has one primary button: **Call** (with the number from tablet width up, "Call 0917 123 4567", since a shared link is often opened on a computer), or Messenger when there's no phone, or Directions when there's neither. Call dials the branch's first phone number |
| UX10 | **Prices** | "₱500–₱800", "From ₱500", or "Call for price", plus the unit when it isn't per visit ("/night"). A footnote on the clinic page: "Prices are estimates. Please confirm with the clinic." |
| UX11 | **Report incorrect info** | A bottom sheet: choose what's wrong (hours · phone · address · services · closed permanently · other) → optional note → send. No login, invisible Turnstile, thank-you state |
| UX12 | **Zero results** | Never a dead end. Offer to widen the radius (25, then 50 km), search without each filter or without the words, or search all areas instead of one city, and offer the emergency clinics when it's night time in Manila (7 PM–7 AM). The query is logged for ops |
| UX13 | **Hours editor** | A weekly grid with a "Closed" toggle per day, multiple intervals per day (lunch break), "copy to all weekdays", overnight shown clearly ("until 2 AM next day"), a list of upcoming exceptions (holidays, special hours) added with a date picker, a one-tap **"Closed today"** action with an optional note (for sudden closures: sick vet, power outage; also on the dashboard overview), and a live preview of how owners will see it. This is the most complex form, so prototype it for clinic interviews |
| UX14 | **Admin vs dashboard density** | `/admin`: dense tables, keyboard-friendly, desktop-first. `/dashboard`: mobile-first, one task per screen, big controls |
| UX15 | **Language** | English copy at launch, written plainly. Search understands Filipino terms (PRD §7.1). All UI strings go through an i18n layer from day 1 so Filipino can be added later (**next-intl**, strings in `apps/web/messages/en.json`; no locale in URLs yet) |
| UX16 | **Dark mode** | Not at launch. Tokens are structured so it can be added without refactoring |
| UX17 | **Listings with no hours data** | Show them, don't hide them; coverage matters. Status reads **"Hours unknown"** (the `--status-unknown` style) with what to do on the next line in body text, since that's the useful part: "Call before you go.", "Message before you go." without a phone, or "There's no phone or Messenger listed to check first." with neither. The page never tells owners to call a branch they can't call: without a phone, "Call for price" reads "Ask for price", and the products footnote and the no-services line say to message or ask when visiting. These listings are excluded from the "Open now" results, appear in emergency results only when they accept emergencies and have a phone (UX7, UX19), and rank below listings with hours |
| UX18 | **Bottom tab bar** | None in P1 (see §4). Revisit in P2 when accounts, favorites, and pets add enough sections |
| UX19 | **"Accepts emergencies"** | The flag promises that owners **can call the branch about an emergency even when it's closed** (by phone, not necessarily a walk-in). The clinic page says "Takes emergencies" while open and "Closed now · call for emergencies" when closed ("Call for emergencies" when hours are unknown), in normal text with a neutral icon, in bold when closed or unknown (then it's the one thing to act on). A branch with the flag but no phone number shows no emergency line: the promise is a phone call: emergency red is only for entries to emergency help: the Emergency chip and view (UX7), the home emergency band (UX22) and the night-time zero-results link (UX12). Confirm the wording in clinic interviews (it's what a clinic agrees to when the flag is set) |
| UX20 | **Time on cached pages** | Public pages are cached and can be days old when served (ARCHITECTURE D41), so the HTML never states anything that depends on the current time. Before the browser takes over it shows the named day's hours ("Thursday: 8 AM – 5 PM"), the confirmation date ("Hours confirmed Nov 6, 2026 by PAW") and no "Today" row; then the browser shows the open status, "5 days ago" and today's row |
| UX22 | **Home below the search** (decided 2026-11-19, issue P1-5d) | The home is the landing page for the whole platform, so it should be **attractive and useful at once**, without hiding the search (UX1 still holds: the search is the whole top). Below it, in this order: **(A) emergency band**: "Pet emergency? See clinics open now or taking emergency calls ›" in emergency red, the third place that color appears (after the chip and the view, UX7), since it's an entry to the emergency view; at night (7 PM–7 AM Manila) it moves above the search's chips and grows; **(D) "Open now in {city}"**: the 3 nearest branches open now as result cards (UX3) and "See all open now ›", hidden when none are open, never a fake or empty state; **(B) "What does your pet need?"**: 6 tiles from the service groups, named in owners' words (Check-up · Bakuna & purga · Kapon & surgery · Lab & X-ray · Confinement · Grooming & boarding), each opening that search; **(C) "Who's your patient?"**: every animal as a big booklet sticker, led by "Not every clinic treats rabbits, birds or reptiles. Find one that does."; **(E) "Hours you can trust"**: the confirmation stamp (§7.1) drawn large beside 2–3 lines that are true today (every page shows when hours were last confirmed and by whom; no promise of monthly clinic confirmations until P1-10 ships). It mirrors the owner deck's "Info you can trust" slide (pitch/pet-owners.md §4) and grows with it: "Spot a mistake? Report it" once P1-7 ships, "Verified clinics run their own pages" once P1-8 does; **(F) a booklet illustration**: an inline SVG of an open health booklet with stickers and a stamp, in the tokens, beside the search on desktop and small above it on phones; no mascots or cartoons (§7.1), and the brand kit (P0-D3) may redraw it. With B and C on the page, the quick chips shrink to **Open now · Emergency**. Under the search, a small line carries the owner promise from the pitch kit: **"Free · No sign-up needed"**. No "coming later" features on the home (the kit gives them no dates). Later, each when the page it links to exists: browse by city and a "For clinics" band (P1-6, copy from the clinic one-liner in pitch/clinics.md §1), real coverage numbers once they reassure (P1-11a). Budget: everything server-rendered except the time-dependent band and status lines; no images beyond the SVG (§9) |
| UX21 | **Species filter on the clinic page** (planned, not built) | Species treated sit in the header (UX8) because they decide whether the rest of the page matters; branch cards show them too. A filter of species chips above the services ("Cat" shows only what covers cats, with its price) is planned, with these rules: **shown only when it helps** (the branch treats 2+ species, lists about 8+ services, and some services name a species); **services with no species stay visible under every filter** (most imported services have none: they read as "ask the clinic"); **no `?species=` in the URL** (it would make the cached page render per request, ARCHITECTURE D41): chips are a small client component or CSS-only (`:has()`); arriving from a species search ("vet for rabbits") preselects that species. Build it with P1-5b (the search preselect is its strongest use) or once real clinics have species on their services, and check in the 3–5 person usability test whether owners look for it |

## 7. Brand & visual identity

**Status (decided 2026-11-19):** the founder chose not to wait for the brand name to replace the placeholder look (teal, system font, plain wordmark). The new design, **"Pet health booklet"** (§7.1), was chosen from directions explored with Impeccable (§1) and built first on the clinic page. It must feel **warm and friendly to pet owners, easy to find your way around, and every action obvious** (principle 9), and never childish, generic, cold or busy. What stays: the working name **PAW** and the lucide `PawPrint` icon (the brand kit, P0-D3, still delivers the final name and logo mark), the UX principles (§2), the accessibility rules (§10) and the performance budget (§9). It covers **owner pages and `/dashboard`**; `/admin` stays dense shadcn defaults (UX14), though it shares the tokens and font. Its tokens are binding: later design work stays inside them.

### 7.1 "Pet health booklet"

Every Filipino pet owner has the booklet a vet hands out: a colored cover, entries written in, vaccine stickers, and a stamp with a date for every visit. PAW's pages borrow that: plain entries, sticker labels for the animals a clinic treats, and **every confirmation stamped with its date**. Trusted, warm and familiar, never cartoonish.

| Item | Value | Notes |
|---|---|---|
| Name | **PAW** | Working name until the brand kit |
| Logo | Wordmark "PAW" (extra bold) + lucide `PawPrint` | White on the blue header band, blue on white elsewhere (`Wordmark onPrimary`). The icon is the favicon |
| Font | **Nunito Sans** (Google Fonts, OFL), self-hosted with `next/font` | Warm humanist sans, not rounded-childish. Has the ₱ sign (in its `latin-ext` file, which loads only when a price is shown; only `latin` is preloaded). Weights: 400 body, 600–700 labels and buttons, 800 names and statuses |
| Type steps | `text-title` (clinic name, 28–32px), `text-status` (the big status, 24px) | Named in `globals.css` `@theme`; everything else uses Tailwind's scale. Never below 16px for body text |
| Radius | `0.75rem` | Buttons `rounded-xl`, cards and the status page `rounded-2xl`, stickers `rounded-md` |

| Token | Value | Use |
|---|---|---|
| `--primary` | `#2F6FB2` booklet blue | The header band, buttons, links, focus ring. White on it is 5.2:1 |
| `--binding` | `#F4C6D2` binding pink | The strip under the header, ruled lines inside the status page, text selection. Never text |
| `--page` | `#FCEEF2` booklet page | The one booklet page that leads: the status card (and the closed notice in its place). Kept rare so it stays the first thing read |
| `--stamp` | `#5A3E9B` stamp violet | Confirmations only: the hours stamp and the verified badge (`--verified` points to it) |
| `--accent` | `#FFF3C9` butter | Today's row in the hours table. Backgrounds only |
| `--background` | `#FFFFFF` | Page |
| `--foreground` | `#1E2430` booklet ink | Body text |
| `--muted` | `#EEF2F8` | Hover tint, quiet surfaces |
| `--muted-foreground` | `#5B6273` | Secondary text (also `--status-unknown`) |
| `--border` | `#DCE3EE` | Ruled lines, card borders. `--input` is a little darker so fields read as fields |
| `--status-open` | `#1F7A3E` | "Open" |
| `--status-closing` | `#9A4A00` | "Closing soon" |
| `--status-closed` | `#B91C1C` | "Closed" (also `--destructive`) |
| `--stale` | `#9A4A00` | Freshness warnings, and the stamp when hours are aging |
| `--emergency` | `#C81E1E` | Emergency chip and view |

**Contrast:** every text color above meets WCAG AA (≥ 4.5:1) on white **and** on the `page`, `muted` and `accent` tints (lowest: `primary` on `page`, 4.62:1), so status and secondary text may sit on any of them; the old "status text only on white" rule is gone. The values live, converted to OKLCH, in `apps/web/src/app/globals.css`.

**What makes it the booklet** (keep these when building new screens):
- **The header is the cover:** a booklet-blue band with the wordmark in white and a 6px binding-pink strip under it. A white **"Find a vet"** button on its right goes to the search page (since P1-5b).
- **Entries on ruled lines:** the clinic name and every section heading sit on a 2px ruled line (`border-b-2`). Groups inside a section (service categories) are **entry labels**: small extra-bold uppercase text in `muted-foreground` on a 2px `binding` rule, with their rows on white below.
- **Sticker labels** for what a clinic treats (species): white, hairline border with a 2px lower edge, `rounded-md`. Not pills.
- **The confirmation stamp** (the signature, `ConfirmationStamp` in `components/listing/live-status.tsx`): tilted 2°, a 2px stamp-violet border, "HOURS CONFIRMED" over "Nov 6, 2026 · by the clinic". Its date is fixed, so it's in the cached HTML (UX20). Once the browser knows the time, a line under it says "Confirmed 5 days ago."; when hours are aging or stale (UX5) the stamp turns `stale` amber and the line warns "May have changed. Call ahead.". Hours never confirmed get **no stamp**, only the warning text. Use the stamp only for real confirmations (hours, verification), never as decoration.
- **Depth from tint before shadow:** shadows only on things that float (the sticky contact bar, dialogs, popovers).
- **No mascots, cartoons, puns or emoji.** Warmth comes from the cover colors, soft shapes, the stamp and the words (§2.1).

**Brand kit (P0-D3) still delivers:** the final name, a logo mark (SVG, full + icon-only, light and dark), favicon/app icon, and the photo/illustration direction. It starts from this palette and font and may refine them.

## 8. Design tokens & components

**Tokens** are CSS variables in `apps/web`, following shadcn/ui's naming so every component themes automatically:
- **shadcn base:** `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`.
- **PAW semantic tokens:** `--status-open`, `--status-closing`, `--status-closed`, `--status-unknown`, `--verified`, `--emergency`, `--stale`.
- Components use tokens, never raw hex values. Changing the brand = editing one file.

**Other foundations:**
- **Type:** the brand font (Nunito Sans, §7.1) is self-hosted via `next/font` (no layout shift, no Google request at runtime). Minimum body text is 16px.
- **Icons:** lucide (shadcn's default). Species icons may need a small custom set.
- **Control size:** shadcn's default buttons and inputs are 32–36px tall, which suits `/admin`'s density only. Owner pages and `/dashboard` use controls at least 44px tall (§10), with 16px text in inputs (which also stops iOS zooming in on focus).

**Making actions obvious** (principle 9; owner pages and `/dashboard`, not `/admin`):
- **Buttons for actions, at least 44px tall (48px on owner pages, 56px in the contact bar), with a verb label** and an icon where it helps. Primary (`bg-primary`, bold white text) for the one main action in a group, outline (a **2px `primary` border at rest**, `text-primary`) for the others, so a secondary button never looks like a plain box. Never an icon alone.
- **Text links say where they go:** underlined, or followed by an arrow (`ChevronRight`), in `text-primary`. `text-primary` is kept for things that can be tapped: headings and plain text never use it.
- **A card that opens something shows its action as a visible button** ("View branch ›"), lined up with the card's other buttons. Only the buttons are tappable, not the whole card: one obvious target per action, and no hidden tap areas. The card's border may turn `primary` on hover to show which item the buttons belong to. Its heading is plain text, not a link. Reference: `BranchSummary` in `components/listing/sections.tsx`.
- **Line up repeated actions:** cards in a row have their buttons at the bottom (`mt-auto`), in the same order (Call, then View).
- **Every tappable thing has hover and press feedback**, plus the global focus ring. Primary buttons darken on hover (darker, never lighter, so white text keeps its contrast); outline buttons tint `muted`; cards (2px border) turn their border `primary`; text links thicken their underline. Buttons press down 1px when tapped. Transitions are short (150 ms) and off under reduced motion. Hover only adds: the resting state must already look tappable, since phones have no hover. The owner-page button styles live in `apps/web/src/lib/action-styles.ts` (`primaryAction`, `outlineAction`); use them instead of new ones.
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

- [ ] Brand name → brand kit (§7). **Open.** The working name PAW stays meanwhile.
- [x] Replace the placeholder look before the brand kit → yes, a new visual design for owner pages and `/dashboard` now; the kit keeps the name and logo mark (§7, 2026-11-19).
- [x] Price ranges on result cards → only for service searches (UX3).
- [x] Directions → ask Google Maps vs Waze once, then remember the choice (UX9).
- [x] Bottom tab bar → none in P1; revisit in P2 (UX18).
- [x] Listings with no hours data → shown as "Hours unknown" with how to check first, excluded from open-now results, ranked lower (UX17).
