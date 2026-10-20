---
type: note
tags: [project, architecture]
created: 2026-10-20
updated: 2026-10-20
summary: Code layout of the Next.js app, the engine/agent split and the agent's tools.
---
# Architecture

One Next.js 16 app in `web/`. No database: the simulated world lives in JSON in the repo.

## The key design choice
**Plain code checks, the LLM explains.** `web/src/lib/engine.ts` computes every connection, arrival time, rupee and layover. Claude only reads those results, ranks trade-offs in words and drafts messages. After Claude finishes, the engine re-ranks and overrides any verdict that contradicts the numbers. Answer to "what if the AI hallucinates?" See [[Decisions]].

## Files
| Path | What it does |
|---|---|
| `web/src/data/trip.json` | The traveller's booking chain |
| `web/src/data/scenarios.json` | 4 disruptions, each with its inventory (`legs`) and candidate `plans` |
| `web/src/lib/engine.ts` | `findAffected` (walk the chain), `parseConstraints`, `evaluatePlan` / `rankPlans`, `explain`, `draftActions`. No imports, runs in Node too |
| `web/src/lib/agent.ts` | Claude tool-use agent + offline planner fallback. Streams `AgentEvent`s |
| `web/src/app/api/agent/route.ts` | POST endpoint, streams NDJSON |
| `web/src/components/DominoChain.tsx` | The chain UI: dominoes tip over in sequence, times flip like a departure board |
| `web/src/components/demo/*` | Demo console: `useAgent` (stream reader), `Plans`, `Actions`, `DemoConsole` |
| `web/src/components/StrandedChat.tsx` | 1/2/3 chat, CSS-only animation, runs the engine client-side |
| `web/src/components/landing/Islands.tsx` | Animated landing page pieces |
| `web/scripts/check-engine.ts` | Self-check of the demo story: `npm run check` |

## Agent tools
`get_bookings`, `find_affected`, `search_alternatives`, `check_constraints` (Claude passes the limits it read from the traveller's words), `build_itinerary`, `draft_messages`, `present_recommendation`.
Model `claude-opus-5-5`, effort `low` for demo speed, server-side refusal fallback on.
No `ANTHROPIC_API_KEY`: runs the same steps with the engine's own explanations ("Built-in planner"). Also the fallback if the API fails mid-demo.

## Scoring (engine)
Hard fails rule a plan out: misses deadline, over budget, overnight bus, idle wait over the layover limit.
Score = 100 + arrival buffer (max 30) - cost share of budget (x25) - changes (x8 with a companion, else x5) - late-night arrival with companion (10) - late check-in (8) - new hotel distance (x2) - tight hotel desk (8).

## Motion
Motion (`motion/react`) everywhere except stranded mode. `MotionConfig reducedMotion="user"` in `Providers.tsx` respects OS settings. Page transitions in `app/template.tsx`.

Related: [[Domino Overview]], [[Changelog]]
