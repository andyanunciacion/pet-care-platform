---
name: PAW
description: Find a vet that's open, treats your pet, and offers what you need, in Angeles City and Region 3.
colors:
  primary: "oklch(0.511 0.086 186.4)"
  primary-foreground: "oklch(1 0 0)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.208 0.04 265.8)"
  muted: "oklch(0.968 0.007 247.9)"
  muted-foreground: "oklch(0.554 0.041 257.4)"
  accent: "oklch(0.962 0.058 95.6)"
  border: "oklch(0.929 0.013 255.5)"
  destructive: "oklch(0.505 0.19 27.5)"
  status-open: "oklch(0.527 0.137 150.1)"
  status-closing: "oklch(0.555 0.146 49)"
  status-closed: "oklch(0.505 0.19 27.5)"
  status-unknown: "oklch(0.554 0.041 257.4)"
  stale: "oklch(0.555 0.146 49)"
  verified: "oklch(0.546 0.215 262.9)"
  emergency: "oklch(0.577 0.215 27.3)"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
rounded:
  sm: "0.45rem"
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.05rem"
  2xl: "1.35rem"
spacing:
  gutter: "16px"
  card: "16px"
  card-sm: "12px"
  container: "64rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  chip:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
---

# Design System: PAW

> Summary for design tools (Impeccable), derived from the code. **The tokens' source of truth is `apps/web/src/app/globals.css`**, and **design decisions live in [AI_DOCS/DESIGN.md](AI_DOCS/DESIGN.md)** (UX principles §2, voice §2.1, UX decisions §6, brand §7, tokens §8, performance §9, accessibility §10). If this file disagrees with either, they win: re-run `/impeccable document` to refresh it.
>
> **Placeholder brand** (AI_DOCS/DESIGN.md §7.1), binding until the brand kit (P0-D3). Work inside these tokens: flag contrast or hierarchy problems, but don't propose new palettes, fonts or logos.

## Overview

**Creative North Star: "The Neighbor Who Knows"**

PAW is the local who has already called around: they know which clinic is open right now, which one sees rabbits, and roughly what a *kapon* costs, and they tell you plainly. Warm, local and word-of-mouth in feel, but the facts are exact and dated. Friendliness comes from soft shapes, warm tints and plain words, never from cartoons, mascots or jokes.

Density depends on the audience (UX14). Owner pages are mobile-first at 360 px and say one thing at a time: status, distance, **Call**. The clinic dashboard has big forgiving controls, one task per screen. `/admin` is dense and desktop-first, with shadcn defaults. In an emergency the warmth steps back and only the facts and actions remain.

**Key Characteristics:**
- Status first: open / closing / closed / unknown, always as text + icon + color.
- Freshness is always visible ("Hours confirmed 5 days ago by the clinic").
- Soft, rounded, friendly surfaces on a white page; color is kept for status and actions.
- Light: the system font, no decorative images, a map only when asked for.

## Colors

A calm white-and-slate base with one teal brand color, a warm amber tint, and a strict set of status colors that carry meaning.

### Primary
- **Clinic Teal** (`primary`): buttons, links, the wordmark, focus rings. It stands for health and trust.

### Secondary
- **Warm Amber Wash** (`accent`): warm highlight backgrounds only (a tinted note, a highlighted row such as today's hours). Never text.

### Neutral
- **Clean White** (`background`): the page and cards.
- **Deep Slate Ink** (`foreground`): body text.
- **Soft Slate Wash** (`muted`): quiet tinted surfaces, chips, table headers.
- **Quiet Slate** (`muted-foreground`): secondary text. It's the lowest-contrast text allowed (4.76:1 on white).
- **Hairline Slate** (`border`): borders, dividers, input strokes.

### Semantic (status)
- **Open Green** (`status-open`), **Closing Amber** (`status-closing`), **Closed Red** (`status-closed`), **Unknown Slate** (`status-unknown`): open status (UX4).
- **Stale Amber** (`stale`): freshness warnings (UX5).
- **Verified Blue** (`verified`): the verified badge only (UX6).
- **Emergency Red** (`emergency`): the Emergency chip and view only (UX7).

### Named Rules
**The Meaning-Only Color Rule.** Status, stale, verified and emergency colors mean exactly one thing each. Never use them for decoration, and never show status by color alone (UX4).

**The White-Under-Status Rule.** `muted-foreground`, `status-unknown` and `emergency` pass AA only on white (they reach 4.34–4.41:1 on `muted`). Status lines, freshness and secondary text sit on white (cards take a hairline border instead of a tint), and anything on a `muted` or `accent` tint uses `foreground` (AI_DOCS/DESIGN §7.1).

**The Token-Only Rule.** Components use the Tailwind classes these tokens produce (`bg-primary`, `text-status-open`), never raw values. Changing the brand is an edit to `globals.css` only.

## Typography

**Body Font:** the system UI stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), one family for everything.

**Character:** familiar and instant. No download, no layout shift, and Roboto on Android has the ₱ sign.

### Hierarchy
- **Headline** (700, 1.875rem, tight tracking): the page title (clinic name, page heading).
- **Title** (500, 1rem): card and section titles.
- **Body** (400, 1rem, 1.5): all reading text. **16px is the minimum** (DESIGN §8), and the base layer enforces it.
- **Label** (500, 0.875rem): secondary lines, form labels, freshness notes.

### Named Rules
**The 16px Floor Rule.** Owner-facing body text is never below 1rem. `text-sm` is for secondary lines only, and never for a phone number, a price or a status.

## Layout

Mobile-first: design at 360 px wide, with a 16px side gutter (`px-4`) and a centered `max-w-5xl` (64rem) container. Public pages have a slim top bar (wordmark; compact search on inner pages) and no bottom tab bar in P1 (UX18). On clinic pages the primary actions sit in a sticky bottom bar in the thumb zone (**Call · Messenger · Directions**, UX8). Species treated sit in the clinic page header as one row ("Treats" + a `muted` pill per animal; smaller pills on branch cards), not in a section further down. The mobile results view shows a list with a map toggle; desktop shows list and map side by side (UX2). Spacing follows Tailwind's 0.25rem scale; cards pad 16px (12px when compact).

## Elevation & Depth

Today it's flat: cards are separated by a hairline ring (`foreground` at 10%) on white, with no shadows. In keeping with "soft and friendly", depth comes from **tint, not shadow**: `muted` or `accent` surfaces group and highlight content. Only floating layers (bottom sheets, popovers, the sticky contact bar) may use shadcn's own shadows, to separate them from the page underneath.

### Named Rules
**The Tint-Before-Shadow Rule.** To group or lift content, use a tinted surface first. A shadow is only for something that really floats above the page.

## Shapes

Soft, generous rounding from one radius token (`--radius`, 0.75rem): controls `lg`, cards `xl`, chips and badges fully rounded pills. Corners are friendly but not bubbly. Borders are hairlines in `border`.

## Components

**Soft and friendly**: rounded, tinted, easy to hit. They reassure without decoration.

### Buttons
- **Shape:** rounded corners (`rounded.lg`, 0.75rem).
- **Primary:** Clinic Teal with white text. Used for the main action on a screen, such as **Call** on a result card or in the contact bar.
- **Outline / Ghost:** white or transparent, hairline border, tinting to `muted` on hover. For secondary actions (Messenger, Directions).
- **Hover (owner pages):** primary darkens (never lightens: white text keeps its contrast); outline tints `muted` and its border turns `primary`. Styles: `primaryAction` / `outlineAction` in `apps/web/src/lib/action-styles.ts`.
- **Focus:** a 3px teal ring at 50% opacity. **Active:** a 1px press-down.
- **Size:** shadcn's defaults (32–36px tall) are admin density only. **Owner pages and `/dashboard` use controls at least 44px tall** (DESIGN §10).

### Chips
- **Style:** pills on `muted` (quick chips: Open now · Kapon · Bakuna · species). The Emergency chip uses `emergency` and is always visible on home and results (UX7).
- **State:** not built yet (slice 5). Whatever marks a chip as selected can't be color alone (DESIGN §10).

### Cards / Containers
- **Corner Style:** `rounded.xl`.
- **Background:** white, with a hairline ring; `muted` or `accent` tint for grouped or highlighted content.
- **Internal Padding:** 16px (12px compact).
- **Cards that open something** (e.g. a branch card): the action is a visible outline button at the bottom ("View branch ›"); only the buttons are tappable, not the whole card. The card heading is plain text. Repeated cards line their buttons up at the bottom (`mt-auto`). The card border turns `primary` on hover.

### Named Rules
**The Looks-Tappable Rule.** Anything tappable looks tappable at rest, with no hover needed (phones have none): a button shape (≥44px, verb label) or a link that is underlined or ends in an arrow. `text-primary` is reserved for tappable things; headings and plain text never use it. Repeated buttons carry a visually hidden target ("Call Balibago"). Source: AI_DOCS/DESIGN §2 principle 9 and §8 "Making actions obvious".

### Inputs / Fields
- **Style:** hairline `input` stroke, transparent background, `rounded.lg`, 16px text on mobile (it also keeps iOS from zooming in on focus).
- **Focus:** the same 3px teal ring as buttons. **Error:** a destructive-red border and ring, with the message in plain words next to the field.
- Labels are always visible, never placeholder-only (DESIGN §10).

### Open status (signature)
`OpenStatusText` (`components/hours/open-status.tsx`): a lucide circle icon plus a semibold colored label, then the detail in body color ("**Open** · closes 6 PM"). `HoursFreshness` sits below it in `label` size: muted when fresh, Stale Amber with an alert icon when aging or stale. Every place an owner sees hours uses these two.

## Do's and Don'ts

### Do:
- **Do** show status as text + icon + color, and freshness with its source, wherever hours appear.
- **Do** keep the main action (**Call**) primary-colored, in the thumb zone, and at least 44px tall on owner and clinic screens.
- **Do** use `muted` / `accent` tints to group content before reaching for borders or shadows.
- **Do** pair every icon with a visible label (DESIGN §2, principle 6).
- **Do** make every action look tappable at rest: a button with a verb label, or an underlined or arrowed link (the Looks-Tappable Rule).

### Don't:
- **Don't** use raw color values, or status colors for decoration.
- **Don't** make a colored heading or bare text the only way into something, or color text `primary` when it can't be tapped.
- **Don't** add mascots, cartoon illustrations, pet puns or emoji: friendly, not childish (DESIGN §7).
- **Don't** add motion, hero images or extra client JavaScript to owner pages without a reason; the performance budget (DESIGN §9) is for mid-range Android on mobile data.
- **Don't** put anything in the emergency view except the status (open now, or "call for emergencies"), distance and **Call** (UX7).
