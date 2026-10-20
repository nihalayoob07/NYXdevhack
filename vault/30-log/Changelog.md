---
type: note
tags: [log]
created: 2026-10-20
updated: 2026-10-20
summary: Every change to the project, newest first. One entry per commit.
---
# Changelog

Newest first. Use the [[Changelog entry]] template: date, who, what changed, why, notes touched.

## 2026-10-20: Renamed the product to Travv (Raahil)
**What:** Every user-facing "Domino" is now "Travv": nav, page titles, product copy, console, setup, stranded mode, the agent prompt, README, vault and the ticket-stack preview. The overview note is now [[Travv Overview]]. Kept on purpose: the `DominoChain` component name, the `domino.trip.v1` storage key (renaming it would wipe trips people already saved) and the `domino-nyx` Vercel URLs.
**Why:** New product name.
**Notes touched:** [[Home]], [[Travv Overview]], [[Architecture]], [[Demo Script]], [[Decisions]]

## 2026-10-20: Real product MVP: your own trip (Nihal)
**What:** `/` now works for any traveller. New trip: paste confirmations (`/api/parse`, Groq) or add by hand, check every field, set limits; saved in `localStorage`. Something went wrong: pick a booking, delayed or cancelled; the engine shows what breaks. Find a way through: the gap to fill, prefilled real searches, "I found one" form; the engine checks each option, "Compare with AI" explains, approve, "Save as my trip". Drafts send via WhatsApp / email. Engine generalised: any weekday (`trip.week`), any airline, optional companion/hotel/waiting-for, passenger count; `verdictOf` moved to the engine. Agent and `/api/agent` take `{ trip, scenario }`. New: `recover.ts`, `store.ts`, `schema.ts`, `App`, `Setup`, `ui`, `Avatar`. Example trip kept behind "Try an example trip".
**Why:** An MVP should be the product a real traveller can use, not a demo.
**Notes touched:** [[Handoff]], [[Architecture]], [[Decisions]], [[Demo Script]], [[Tasks]]

## 2026-10-20: Full product back at /, in the ticket stack look (Nihal)
**What:** The previous commit shipped only the preview's phone flow. Replaced it with the full product: the former demo console (`components/app/Console.tsx`, `Plans.tsx`, `Actions.tsx`, `FlipText.tsx`) restyled in the ticket stack look. Bookings show as a ticket stack with stamps, disruptions arrive as a notification, all original features kept (airline comparison, agent log, limits, options, ruled out, repaired trip, actions). Paper palette and fonts are now global, so stranded mode matches. Nav is back on every page. Removed `TripApp.tsx` and Geist fonts.
**Why:** The goal was the AI product in the new theme, not the preview copied.
**Notes touched:** [[Handoff]], [[Architecture]], [[Decisions]], [[Demo Script]], [[Tasks]]

## 2026-10-20: Ticket stack app replaces the landing page (Nihal)
**What:** `/` is now the product: a phone-sized app in the ticket stack look (`components/app/TripApp.tsx`, `Ticket.tsx`). Flow: home → push notification → alert with stamped tickets → editable limits → Fix my trip (live agent) → ranked options → review with drafted actions → booking → repaired trip. Real engine and agent data, all 4 scenarios via "Demo: send a disruption". Removed the landing page, `DominoChain`, the demo console and its `Plans`/`Actions`; `/demo` redirects to `/`. Nav only shows on stranded mode. New fonts Fraunces, Space Mono, Inter Tight. Preview saved in `vault/10-project/design/`.
**Why:** The site should be the solution as its own product, not an explainer. MVP: essentials only.
**Notes touched:** [[Handoff]], [[Architecture]], [[Decisions]], [[Demo Script]], [[Tasks]], [[Home]]

## 2026-10-20: Groq instead of Claude, auto-deploy (Nihal)
**What:** `agent.ts` now calls Groq's OpenAI-compatible endpoint with `fetch` (key `GROQ_API_KEY`, model `GROQ_MODEL`, default `openai/gpt-oss-120b`). Lookups run server-side and go in the first message; a run is exactly 2 requests (forced `check_constraints` tool call, then a JSON-mode recommendation in the engine's order), about 4,000 tokens, ~2 s. Retries once on a short 429. Prompt rules stop invented facts (a test run claimed a kept hotel was lost). Model output validated with zod. Removed `@anthropic-ai/sdk`. UI labels say "Live AI (Groq)" / "The AI". New Vercel project `nyxdevhack` linked to the repo: pushes to `main` deploy to https://nyxdevhack.vercel.app.
**Why:** Free API for the shortlist. Gemini was tried first but Google denied the project access (403).
**Notes touched:** [[Architecture]], [[Decisions]], [[Tasks]], [[Demo Script]]

## 2026-10-20: Deployed to Vercel (Raahil)
**What:** Live at https://domino-nyx.vercel.app (Vercel project `domino-nyx`, Raahil's account, root `web/`). Deployed from a local copy with the Vercel CLI because Vercel can't link a repo owned by another GitHub account, so pushes do not auto-deploy yet. Runs the built-in planner until `ANTHROPIC_API_KEY` is added in Vercel.
**Why:** Judges and teammates need a public link.
**Notes touched:** [[Architecture]], [[Tasks]]

## 2026-10-20: Initial build (Raahil)
**What:** Next.js 16 app in `web/` with:
- Simulated world: `trip.json` (flight → train → hotel → wedding) and `scenarios.json` (inbound delay, flight cancelled, train cancelled, hotel overbooked).
- `engine.ts`: chain walk, plain-language constraint parser, plan evaluation and ranking, explanations, drafted actions (refunds, DGCA claim, hotel, family). Self-check: `npm run check`.
- `agent.ts` + `/api/agent`: Claude Opus 5.5 tool-use agent streaming each step, with an offline planner fallback.
- Pages: landing (`/`), demo console (`/demo`), stranded mode (`/stranded`). Motion: domino tipping, split-flap times, page transitions, scroll-linked text.
- This vault and the pre-commit hook that requires a changelog entry.
**Why:** Hackathon MVP, see [[Travv Overview]].
**Notes touched:** [[Home]], [[Architecture]], [[Decisions]], [[Demo Script]], [[Team]], [[Tasks]]
