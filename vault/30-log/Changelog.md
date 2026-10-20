---
type: note
tags: [log]
created: 2026-10-20
updated: 2026-10-20
summary: Every change to the project, newest first. One entry per commit.
---
# Changelog

Newest first. Use the [[Changelog entry]] template: date, who, what changed, why, notes touched.

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
