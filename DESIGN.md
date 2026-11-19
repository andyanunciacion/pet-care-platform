---
name: PAW
description: Find a vet that's open, treats your pet, and offers what you need, in Angeles City and Region 3.
colors:
  primary: "oklch(0.534 0.124 252.1)"
  primary-foreground: "oklch(1 0 0)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.26 0.024 264)"
  page: "oklch(0.961 0.016 358)"
  binding: "oklch(0.87 0.054 0.9)"
  stamp: "oklch(0.445 0.145 293.5)"
  accent: "oklch(0.963 0.056 94)"
  muted: "oklch(0.96 0.009 258.3)"
  muted-foreground: "oklch(0.496 0.029 267.6)"
  border: "oklch(0.914 0.017 259.4)"
  input: "oklch(0.82 0.025 259)"
  destructive: "oklch(0.505 0.19 27.5)"
  status-open: "oklch(0.512 0.125 150.3)"
  status-closing: "oklch(0.501 0.128 52.5)"
  status-closed: "oklch(0.505 0.19 27.5)"
  status-unknown: "oklch(0.496 0.029 267.6)"
  stale: "oklch(0.501 0.128 52.5)"
  verified: "oklch(0.445 0.145 293.5)"
  emergency: "oklch(0.535 0.203 27.6)"
typography:
  headline:
    fontFamily: "Nunito Sans, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(1.75rem, 1.5rem + 1vw, 2rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  status:
    fontFamily: "Nunito Sans, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.3
  title:
    fontFamily: "Nunito Sans, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Nunito Sans, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Nunito Sans, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  label:
    fontFamily: "Nunito Sans, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 800
    lineHeight: 1.43
    letterSpacing: "0.05em"
  small:
    fontFamily: "Nunito Sans, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
rounded:
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.05rem"
  2xl: "1.35rem"
spacing:
  gutter: "16px"
  stack: "12px"
  card: "16px"
  panel: "20px"
  section: "40px"
  container: "64rem"
components:
  header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    height: "60px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.muted}"
  contact-bar-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
    height: "56px"
  status-card:
    backgroundColor: "{colors.page}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.card}"
  confirmation-stamp:
    textColor: "{colors.stamp}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  confirmation-stamp-aging:
    textColor: "{colors.stale}"
  sticker:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  entry-label:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
  branch-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.card}"
  hours-today-row:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.foreground}"
  search-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "48px"
  chip-quick:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "44px"
  chip-emergency:
    backgroundColor: "{colors.background}"
    textColor: "{colors.emergency}"
    typography: "{typography.button}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "44px"
  chip-filter-active:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: "0 12px"
    height: "44px"
  result-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.card}"
  result-card-service:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "8px 12px"
  filter-sheet:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.panel}"
---

# Design System: PAW

> Summary for design tools (Impeccable), derived from the built code. **The tokens' source of truth is `apps/web/src/app/globals.css`**, and **design decisions live in [AI_DOCS/DESIGN.md](AI_DOCS/DESIGN.md)** (UX principles §2, voice §2.1, UX decisions §6, brand §7 and §7.1, tokens §8, performance §9, accessibility §10). If this file disagrees with either, they win: re-run `/impeccable document` to refresh it.
>
> **The "Pet health booklet" tokens are binding** (AI_DOCS/DESIGN.md §7, decided 2026-11-19): later work stays inside them. The final name, logo mark and image direction still come from the brand kit (P0-D3). Until then the working name **PAW** and the lucide `PawPrint` icon stay.

## Overview

**Creative North Star: "The Pet Health Booklet"**

Every Filipino pet owner has the booklet a vet hands out: a colored cover, entries written in, vaccine stickers, and a dated stamp for every visit. PAW's pages borrow that. The header is the blue cover with a pink binding. Facts are written in as entries on ruled lines. The animals a clinic treats are sticker labels. Every confirmation is stamped with its date. It feels trusted, warm and familiar, never cartoonish, generic, cold or busy.

The voice is **a caring, plain neighbor** (AI_DOCS/DESIGN.md §2.1): short warm English, say what's true, then what to do. Density depends on the audience (UX14). Owner pages are mobile-first at 360px and answer "can I go there now?" in three seconds: status, freshness, **Call**. `/dashboard` inherits this world with big, forgiving controls. `/admin` stays dense shadcn defaults, sharing only the tokens and the font. In an emergency the booklet steps back: only the status, distance and **Call** remain.

**Key Characteristics:**
- The cover header: a booklet-blue band, white wordmark, a 6px binding-pink strip.
- Entries on ruled lines: names and section headings sit on 2px rules.
- One pink booklet page per screen: the status card.
- Sticker labels for species, not pills.
- A tilted violet stamp for every real confirmation, with its date.
- Status always as text, icon and color; freshness always visible with its source.

## Colors

A white page under a booklet-blue cover, with pink for the binding and the one leading page, violet stamp ink for confirmations, and a strict set of status colors.

### Primary
- **Booklet Blue** (`primary`): the header band, every button, every link, the focus ring. White text on it passes at 5.2:1.

### Secondary
- **Booklet Page Pink** (`page`): the status card, or the "Permanently closed" notice in its place. The one booklet page that leads.
- **Binding Pink** (`binding`): the strip under the header, ruled lines inside the status card and under service-group entry labels, and text selection. Never text.

### Tertiary
- **Stamp Violet** (`stamp`, also `verified`): confirmations only. The hours stamp and the verified badge.
- **Butter** (`accent`): today's row in the hours table. Backgrounds only.

### Neutral
- **White** (`background`): the page, cards, stickers, the contact bar.
- **Booklet Ink** (`foreground`): body text.
- **Cool Tint** (`muted`): hover tint on outline buttons and contact rows, quiet tiles such as a product without a photo.
- **Quiet Ink** (`muted-foreground`, also `status-unknown`): secondary text, addresses, entry labels, footnotes.
- **Ruled Line** (`border`): ruled lines, card and panel borders, sticker edges. `input` is a little darker so fields read as fields.

### Semantic
- **Open Green** (`status-open`), **Closing Amber** (`status-closing`), **Closed Red** (`status-closed`, also `destructive`), **Unknown** (`status-unknown`): the open status (UX4).
- **Stale Amber** (`stale`): freshness warnings, and the stamp when hours are aging or stale (UX5).
- **Emergency Red** (`emergency`): entries to emergency help only: the Emergency chip, the emergency view (UX7), the home emergency band (UX22) and the night-time zero-results link (UX12). The clinic page's emergency line stays in body color (UX19).

### Named Rules
**The Meaning-Only Color Rule.** Status, stale, stamp and emergency colors each mean one thing. Never use them for decoration, and never show status by color alone (UX4).

**The Stamp Ink Rule.** Stamp violet marks real confirmations only: the hours stamp and the verified badge. Nothing decorative is ever stamped.

**The One Page Rule.** The `page` pink is the status card (or the closed notice in its place) and nothing else on a clinic page, so it is always the first thing read.

**The Any-Tint Contrast Rule.** Every text color passes WCAG AA on white and on the `page`, `muted` and `accent` tints (lowest: `primary` on `page`, 4.62:1). Status and secondary text may sit on any of them. The old White-Under-Status rule is retired.

**The Token-Only Rule.** Components use the Tailwind classes these tokens produce (`bg-primary`, `text-status-open`, `bg-page`), never raw values. Changing the brand is an edit to `globals.css` only.

## Typography

**Body Font:** Nunito Sans (with `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`), one family for everything, self-hosted with `next/font`. Only the latin file is preloaded; the ₱ sign lives in latin-ext, which loads when a price is shown.

**Character:** a warm humanist sans, friendly without being rounded or childish. Weight carries hierarchy: 400 for reading, 600 to 700 for labels and buttons, 800 for names and statuses.

### Hierarchy
- **Headline** (800, `text-title`, 28 to 32px fluid, 1.15, tight tracking): the clinic name, on a ruled line.
- **Status** (800 label, `text-status`, 24px, 1.3): the open status, the largest line in the status card.
- **Title** (800, 1.25rem, tight tracking): section headings ("Services and prices", "Hours"), on a ruled line.
- **Body** (400, 1rem, 1.5): all reading text, service names, prices (600), addresses.
- **Button** (700, 1rem; 1.125rem for Call in the contact bar): action labels.
- **Label** (800, 0.875rem, 0.05em tracking, uppercase): service-group entry labels and the stamp's "HOURS CONFIRMED" line only.
- **Small** (400, 0.875rem): secondary lines such as price notes, footnotes, contact types and the stamp's "Confirmed 5 days ago."

### Named Rules
**The 16px Floor Rule.** Owner-facing body text is never below 1rem. 0.875rem is for secondary lines only, never for a phone number, a price or a status.

**The Two Named Steps Rule.** Beyond Tailwind's scale there are exactly two named steps, `text-title` and `text-status`. A new size joins them in `globals.css`, never as an arbitrary value in a component.

**The Tabular Numbers Rule.** Tables use tabular numerals so hours line up.

Known gap: the home page h1 (`apps/web/src/app/(public)/page.tsx`) uses an arbitrary clamp size outside the named steps (its search band uses the neutral `muted` tint). It is not a pattern to copy.

## Layout

Mobile-first at 360px: a 16px side gutter and a centered 64rem container. Sections stack 40px apart; inside a section, items stack about 12px apart. The clinic page reads top to bottom: header (logo, name on a rule, address, "Treats" with stickers, the status card), then services, products, hours, contact, address, photos, other branches (UX8). The contact bar (**Call · Messenger · Directions**) is fixed at the bottom in the thumb zone, and the page leaves room for it. From 1024px wide the page splits into the main column and a 22rem right-hand panel (hours, contact, address) with a 2px border on white and 20px padding, so the week sits beside the status it explains. Below 640px the contact bar's secondary buttons stack their icon over a smaller label; Call keeps the most room. Branch cards sit in one column, then two from 640px. Search pages (home and `/search`) put the search box, location line and chips at the top; on home they sit in one `muted` band under the heading. Result cards stack in one column, then two from 768px, with **Show more results** centered below.

## Elevation & Depth

Flat by default. Depth comes from tint and rules, not shadow: the pink status card groups the facts that matter most, 2px ruled lines separate entries, and 2px borders frame cards and the desktop panel. Only things that float get a shadow.

### Shadow Vocabulary
- **Contact bar lift** (`box-shadow: 0 -4px 16px -8px color-mix(in oklch, var(--foreground) 25%, transparent)`): the fixed bottom contact bar, to separate it from the page scrolling under it. Dialogs and popovers keep shadcn's own shadows.
- **Floating sheet** (Tailwind `shadow-xl`, over a 40% ink backdrop): the filter sheet and the directions chooser.

### Named Rules
**The Tint-Before-Shadow Rule.** To group or lift content, use a tint or a rule first. A shadow is only for something that really floats above the page.

## Shapes

One radius token (`--radius`, 0.75rem) drives a soft, booklet-like set: stickers gently rounded (`md`), the stamp and image tiles `lg`, buttons `xl`, cards, the status card and the desktop panel `2xl`. No pills on owner pages. Lines are the booklet's ruling: 2px rules under names and headings, 2px card borders, hairline divides between rows. The stamp is the only element that tilts (2°).

## Components

**Booklet entries**: plain, ruled, easy to hit. They reassure through order and dated proof, not decoration.

### Buttons
- **Shape:** gently rounded (`rounded.xl`).
- **Primary:** Booklet Blue, bold white label, 48px tall. One per group: **Call**, or Messenger when there's no phone, or Directions when there's neither.
- **Outline:** white, a 2px Booklet Blue border at rest, blue bold label, 48px tall. For Messenger, Directions, "View branch".
- **Hover / Focus:** primary darkens (never lightens); outline tints `muted`. Every button presses down 1px. A 3px focus ring at 50% blue, plus the global 2px outline. Transitions are 150ms and off under reduced motion.
- **Contact bar size:** 56px tall; Call takes 1.4 times the room of the others and shows the number from 640px up.
- Source: `primaryAction` / `outlineAction` in `apps/web/src/lib/action-styles.ts`. Use them instead of new styles.

### Cards / Containers
- **Status card:** `page` pink, `rounded.2xl`, 16px padding. The status at `text-status`, the emergency line, then under a 2px binding rule the confirmation stamp and, on mobile, "See all hours ›".
- **Branch card:** white, a 2px `border` frame, `rounded.2xl`, 16px padding. Heading is plain text. Its buttons sit at the bottom (`mt-auto`), Call then View. The border turns blue on hover.
- **Desktop panel:** white, 2px border, `rounded.2xl`, 20px padding.

### Navigation
- **The cover header:** a 60px Booklet Blue band, white wordmark (extra-bold "PAW" + `PawPrint`), a 6px binding-pink strip below, and a white focus ring on the blue. A white "Find a vet" button on its right goes to the search page.

### Links
- Booklet Blue, underlined (thicker on hover), or followed by a chevron. Contact rows are 48px tall with a blue icon and an underlined value.

### Sticker labels
- White, hairline `border` with a 2px lower edge, `rounded.md`, semibold. Compact version (smaller text and padding) on branch cards. Used for the species a clinic treats, after "Treats" with a paw icon.

### Entry labels
- Service groups: 0.875rem extra-bold uppercase in Quiet Ink, on a 2px binding-pink rule, with their rows on white below, divided by hairlines. Prices sit right-aligned in semibold.

### Confirmation stamp (signature)
- `ConfirmationStamp` in `components/listing/live-status.tsx`: tilted 2°, a 2px stamp-violet border, `rounded.lg`, "HOURS CONFIRMED" over "Nov 6, 2026 · by the clinic". The date is fixed, so it's in the cached HTML (UX20). After hydration a small line says "Confirmed 5 days ago."; when hours are aging or stale the stamp and the line turn Stale Amber with an alert icon and "May have changed. Call ahead.". Never-confirmed hours get no stamp, only the warning text.

### Open status
- `OpenStatusText` (`components/hours/open-status.tsx`): a lucide circle icon sized with the text, the extra-bold colored label, then the detail in body color ("**Open** · closes 6 PM"). "Hours unknown" adds what to do on the next line in body text (UX17). Before hydration the cached page shows the named day's hours instead (UX20).

### Hours table
- Weekdays as row headers, tabular numerals, today's row on butter `accent` with "Today" under the day name (after hydration only).

### Inputs / Fields
- **Style:** white, a 2px `input` border, `rounded.xl`, 48px tall, 16px text (no iOS zoom on focus), with a visible label above, never placeholder-only. Selects match.
- **Focus:** the border turns Booklet Blue, plus the 3px ring at 50% blue.
- **Search field:** the text box with a primary **Search** button beside it (icon only below 640px, its label kept for screen readers). Under it, the location line: a pin, "In City of Angeles" or "Near you", then an underlined **Change** that opens a `muted` panel with **Use my location** (outline button) and the city picker.

### Chips
- **Quick chips** (home): outline buttons at chip size, 44px tall, `rounded.xl`, 2px Booklet Blue border and blue bold label: Open now, Kapon, Bakuna, three animals. They submit a search, so they look like buttons, not tags.
- **Emergency chip:** the same shape in Emergency Red with a heart-pulse icon, on home and on the results page. One of the few emergency entries allowed Emergency Red (see Colors).
- **Active filter chips** (results): `muted` fill, 2px blue border, the filter's name and a ✕; each is a link to the same search without that filter.

### Result card
- `ResultCard` (`components/search/result-card.tsx`): white, 2px `border` frame, `rounded.2xl`, 16px padding, like the branch card. Top row: the business name (extra-bold, plain text) and the distance with a pin, right-aligned in Quiet Ink. Then the area line, the verified mark (stamp violet), the open status, the emergency line, and for a service search one `muted` tile with the matched service and its price ("+2 more matching services" below). Then the sticker labels, the short freshness line, and **Call** + **View clinic ›** at the bottom. The border turns blue on hover.

### Filter sheet
- `FilterSheet` (`components/search/filter-sheet.tsx`): a bottom sheet on phones (top corners `2xl`), a centered panel from 640px, built on the Popover API. Title on a 2px rule with **Close**; groups under uppercase entry labels: Animal (radio tiles with a 2px border, blue border and `muted` fill when chosen), Service (a select), "Only clinics open now" (a checkbox); then **Clear filters** (outline) and **Show results** (primary) on a top rule.

### Zero results
- A framed card (2px border, `rounded.2xl`): a search-x icon and an extra-bold "We couldn't find a clinic for that", then underlined blue links with chevrons, one per way out (wider radius, without a filter, all areas). At night (7 PM–7 AM Manila) an emergency link in Emergency Red joins them (UX12).

### Named Rules
**The Looks-Tappable Rule.** Anything tappable looks tappable at rest, with no hover needed (phones have none): a button with a verb label (outline buttons carry a 2px blue border at rest), or a link that is underlined or ends in an arrow. `text-primary` is only for tappable things; a card heading is plain text. Repeated buttons name their target for screen readers. Source: AI_DOCS/DESIGN.md §2 principle 9 and §8 "Making actions obvious".

**The Cached-Truth Rule.** The cached HTML only says what stays true whenever it's served: the stamp's date and the named day's hours. Relative ages, the live status and today's row appear after hydration (UX20).

## Do's and Don'ts

### Do:
- **Do** show status as text + icon + color, and freshness with its source, wherever hours appear.
- **Do** keep the main action (**Call**) Booklet Blue, in the thumb zone, 48px tall on owner pages and 56px in the contact bar; every owner control is at least 44px.
- **Do** put names and section headings on a 2px ruled line, and service groups under uppercase entry labels on a binding rule.
- **Do** keep the `page` pink for the status card (or the closed notice) only.
- **Do** stamp only real confirmations, with their date, and give never-confirmed hours no stamp.
- **Do** make every action look tappable at rest: a button with a verb label and, for outline buttons, a 2px blue border; or a link that is underlined or ends in an arrow (the Looks-Tappable Rule).
- **Do** give repeated buttons a visually hidden target for screen readers ("Call Balibago").
- **Do** pair every icon with a visible label.

### Don't:
- **Don't** use raw color values or arbitrary sizes, or status and stamp colors for decoration.
- **Don't** color text Booklet Blue when it can't be tapped; card headings and plain text stay in ink.
- **Don't** make a whole card tappable or a heading the only way in; the buttons are the targets.
- **Don't** use shadows except on floating layers (contact bar, dialogs, popovers).
- **Don't** add mascots, cartoon illustrations, pet puns or emoji: friendly, not childish (AI_DOCS/DESIGN.md §7).
- **Don't** link the header to a page that doesn't exist yet.
- **Don't** put anything in the emergency view except the status (open now, or "call for emergencies"), distance and **Call** (UX7).
- **Don't** add motion, hero images or extra client JavaScript to owner pages without a reason; the performance budget (AI_DOCS/DESIGN.md §9) is for mid-range Android on mobile data.
- **Don't** restyle `/admin` toward the owner look; it stays dense shadcn defaults (UX14).
