---
type: note
tags: [log]
created: 2026-10-20
updated: 2026-10-20
summary: Every change to the project, newest first. One entry per commit.
---
# Changelog

Newest first. Use the [[Changelog entry]] template: date, who, what changed, why, notes touched.

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
**Why:** Hackathon MVP, see [[Domino Overview]].
**Notes touched:** [[Home]], [[Architecture]], [[Decisions]], [[Demo Script]], [[Team]], [[Tasks]]
