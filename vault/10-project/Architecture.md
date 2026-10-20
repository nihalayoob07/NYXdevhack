---
type: note
tags: [project, architecture]
created: 2026-10-20
updated: 2026-10-20
summary: Code layout of the Next.js app, the engine/agent split and the agent's tools.
---
# Architecture

One Next.js 16 app in `web/`. Pages: `/` the app (ticket stack), `/stranded` low-battery chat, `/demo` redirects to `/`. No database: the simulated world lives in JSON in the repo.

## The key design choice
**Plain code checks, the LLM explains.** `web/src/lib/engine.ts` computes every connection, arrival time, rupee and layover. The LLM (Groq) only reads those results, ranks trade-offs in words and drafts messages. After it finishes, the engine re-ranks and overrides any verdict that contradicts the numbers. Answer to "what if the AI hallucinates?" See [[Decisions]].

## Files
| Path | What it does |
|---|---|
| `web/src/data/trip.json` | The traveller's booking chain |
| `web/src/data/scenarios.json` | 4 disruptions, each with its inventory (`legs`) and candidate `plans` |
| `web/src/lib/engine.ts` | `findAffected` (walk the chain), `parseConstraints`, `evaluatePlan` / `rankPlans`, `explain`, `draftActions`. No imports, runs in Node too |
| `web/src/lib/agent.ts` | Groq tool-use agent (plain `fetch`, OpenAI format) + offline planner fallback. Streams `AgentEvent`s |
| `web/src/app/api/agent/route.ts` | POST endpoint, streams NDJSON |
| `web/src/components/app/TripApp.tsx` | **The app at `/`** (ticket stack design). One client component, screens: home → alert → think → options → review → booking → done. Uses the engine directly and `useAgent` for the live run |
| `web/src/components/app/Ticket.tsx` | One booking drawn as a paper ticket with a stub and a rubber stamp (LATE, MISSED, AT RISK, NEW, KEPT) |
| `web/src/components/app/useAgent.ts` | Reads the agent's NDJSON stream into state |
| `web/src/components/StrandedChat.tsx` | 1/2/3 chat, CSS-only animation, runs the engine client-side |
| `web/scripts/check-engine.ts` | Self-check of the demo story: `npm run check` |

## Agent tools
The server runs `get_bookings`, `find_affected` and `search_alternatives` itself and puts the results in the first message (saves free-tier requests). Exactly two requests per run (about 4,000 tokens):
1. Forced tool call `check_constraints`: the model passes the limits it read from the traveller's words, the engine ranks every plan.
2. JSON mode: the model writes the summary and one explanation per plan, in the engine's order, recommending the engine's top pick. (A forced `present_recommendation` tool call failed on Groq: gpt-oss formats the nested array loosely and Groq rejects it.)
The engine logs `build_itinerary` and `draft_messages` itself. Everything the model returns is validated with zod. On a 429 with a wait of 8 s or less, it waits once and retries ("Free tier is busy" step).
Groq's OpenAI-compatible endpoint, model `GROQ_MODEL` (default `openai/gpt-oss-120b`, free tier 8,000 tokens a minute, so about two runs a minute), temperature 0.2, `reasoning_effort: low`, 30 s timeout per request. Any OpenAI-compatible provider works by changing `GROQ_URL`.
No `GROQ_API_KEY`: runs the same steps with the engine's own explanations ("Built-in planner"). Also the fallback if the API fails mid-demo.

## Scoring (engine)
Hard fails rule a plan out: misses deadline, over budget, overnight bus, idle wait over the layover limit.
Score = 100 + arrival buffer (max 30) - cost share of budget (x25) - changes (x8 with a companion, else x5) - late-night arrival with companion (10) - late check-in (8) - new hotel distance (x2) - tight hotel desk (8).

## Motion
Motion (`motion/react`) everywhere except stranded mode. Ticket stack: screens slide in from the right with a 1° turn, headings type out, stamps thump in, new tickets print in from the top (CSS in `globals.css` under `.paper`). `MotionConfig reducedMotion="user"` in `Providers.tsx` respects OS settings. Page transitions in `app/template.tsx`.

## Deployment
Auto-deploy: https://nyxdevhack.vercel.app. Vercel project `nyxdevhack` (Nihal's `nova` team), linked to the GitHub repo, root directory `web`. Every push to `main` goes to production; other branches get preview links.
Manual: https://domino-nyx.vercel.app. Vercel project `domino-nyx` on Raahil's account. Redeploy with `cd web`, then `npx vercel deploy --prod`.
Env vars: `GROQ_API_KEY` (and optionally `GROQ_MODEL`) in project settings.

Related: [[Domino Overview]], [[Changelog]]
