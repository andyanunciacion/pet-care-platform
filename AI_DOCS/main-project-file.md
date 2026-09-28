# PAW — Start here

PAW is a pet-care discovery platform for the Philippines, launching in Angeles City / Region 3. It is built by a solo founder together with Claude.

| Doc | Answers |
|---|---|
| [PRD.md](PRD.md) | What are we building, for whom, and why? Features by phase, go-to-market, monetization, risks |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How is it built? Stack, system diagram, data model, search, auth, costs, decision log |
| [DESIGN.md](DESIGN.md) | How does it look and behave? UX principles, screens, UX decisions, brand kit, tokens, performance and accessibility |
| [ROADMAP.md](ROADMAP.md) | In what order? Vertical slices with checkboxes and exit criteria per phase |
| [pitch/clinics.md](pitch/clinics.md) · [pitch/pet-owners.md](pitch/pet-owners.md) | What to say and ask in Phase 0 interviews: pitch, deck outline, features, workflows, FAQ, notes template |
| [../CLAUDE.md](../CLAUDE.md) | How should Claude work in this repo? Conventions, glossary, status |

## Changes from the first draft (v1, kept in `archive/`)

- **Stack is TypeScript end-to-end.** FastAPI + Flutter became Fastify + Next.js + Expo, to fit a solo TS founder.
- **Fewer moving parts in the MVP.** No Meilisearch, Redis, Celery, or Socket.IO; Postgres handles search, geo, and jobs.
- **Launch is vets only**, on a data model that is ready for groomers, boarding, and pet shops later.
- **The admin lives inside the Next.js app**, not in a separate Vite/Refine app.
- **Phase 1 is web-only and needs no owner login.** The mobile app, owner accounts, and pet profiles move to Phase 2.
- **Features that directly fix the four core problems moved into Phase 1:** report incorrect info, the emergency/24h filter, and price ranges.
- **Real-time chat became async inquiries** plus Messenger/Viber/call links. Full e-commerce became reserve-and-pickup (P3).
- **The data model is branch-first** from day 1, with clinic membership roles, taxonomies, PSGC addresses, and freshness tracking.
- **New plan sections:** a Phase 0 validation plan, seed-data sourcing rules, PH legal notes (Data Privacy Act, online libel, PRC verification), SEO landing-page strategy, cost estimate, and success metrics.
