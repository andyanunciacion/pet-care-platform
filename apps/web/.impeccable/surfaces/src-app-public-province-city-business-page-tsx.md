---
version: 1
slug: "src-app-public-province-city-business-page-tsx"
primary_target: "src/app/(public)/[province]/[city]/[business]/page.tsx"
related_targets: ["src/app/(public)/[province]/[city]/[business]/[branch]/page.tsx","src/app/(public)/layout.tsx"]
---

# Clinic page (public listing)

Scope: the public clinic page (`[business]` single-branch and `[business]/[branch]`), plus the shared public header. It is the first surface of PAW's new visual world (AI_DOCS/DESIGN.md §7, 2026-11-19); later owner pages and `/dashboard` inherit it. Mode: Operate (the owner completes a task: decide and contact).

Audience and job: a pet owner on a mid-range Android, often worried, deciding "does this clinic treat my pet, is it open, can I trust that, how do I reach them" and then calling. Constraints: AI_DOCS/DESIGN.md §2, §6 (layouts may change if better; record changes in §6), §9 budget, §10 a11y, UX20 cached-page rule. The founder ruled out: childish/cartoony, generic template, cold/clinical, busy/hard to scan.

## Direction contract

THESIS: The clinic page reads like a page of your pet's vet booklet: plain entries written in, and every confirmation stamped with its date. It refuses the category default of white cards, grey hairlines and one teal button.

OWN-WORLD: Booklet-blue header with a pink binding strip under it; white page; grouped facts sit on soft pink "booklet page" tints with ruled dividers and small uppercase entry labels; species and tags are sticker labels (white, hairline, a 2px lower edge); violet rubber-stamp ink is reserved for confirmations (the hours stamp, the verified badge). Nunito Sans throughout. Solid booklet-blue buttons, blue-outline secondary.

STORY: In 3 seconds the owner sees whether the clinic treats their pet, whether it's open, when the hours were confirmed and by whom, and taps Call. A planner reads services and prices as booklet entries further down.

FIRST VIEWPORT: (390 wide) blue header: paw icon + PAW (the "Find a vet" button joins it once a search page exists, P1-5b; no dead-end link before then). No eyebrow (craft-floor ban). Clinic name ~30px on a rule; address; "Treats" + stickers; the status page (pink tint): status at text-status (24px), emergency line, the violet dated stamp, "See all hours" link. Sticky bar at the thumb: Call (blue, widest) · Messenger · Directions.

FORM: Pet health booklet, my rank 1 (IMPECCABLE'S PICK); seed:b018598ff0193c3d. Signature move: the confirmation stamp, a tilted, dated violet stamp ("Hours confirmed · Nov 6, 2026 · by the clinic"); its date is static (cached-page safe), and once the browser knows the time it turns stale amber with "May have changed" when aging; never-confirmed hours get no stamp.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
