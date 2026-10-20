---
type: note
tags: [project, architecture]
created: 2026-10-20
updated: 2026-10-20
summary: Code layout of the Next.js app, the engine/agent split and the agent's tools.
---
# Architecture

One Next.js 16 app in `web/`. Pages: `/` the product (your own trip, saved on the device), `/stranded` low-battery chat (example trip only), `/demo` redirects to `/`. Whole site uses the ticket stack look. No database: the simulated world lives in JSON in the repo.

## The key design choice
**Plain code checks, the LLM explains.** `web/src/lib/engine.ts` computes every connection, arrival time, rupee and layover. The LLM (Groq) only reads those results, ranks trade-offs in words and drafts messages. After it finishes, the engine re-ranks and overrides any verdict that contradicts the numbers. Answer to "what if the AI hallucinates?" See [[Decisions]].

## Files
| Path | What it does |
|---|---|
| `web/src/data/trip.json` | The traveller's booking chain |
| `web/src/data/scenarios.json` | 4 disruptions, each with its inventory (`legs`) and candidate `plans` |
| `web/src/lib/engine.ts` | `findAffected` (walk the chain), `parseConstraints`, `evaluatePlan` / `rankPlans`, `explain`, `draftActions`. No imports, runs in Node too |
| `web/src/lib/agent.ts` | Groq tool-use agent (plain `fetch`, OpenAI format) + offline planner fallback. Streams `AgentEvent`s |
| `web/src/app/api/agent/route.ts` | POST `{ scenarioId }` (example) or `{ trip, scenario }` (your trip), streams NDJSON |
| `web/src/components/app/App.tsx` | `/`: no saved trip → `Setup`, else `Console` |
| `web/src/components/app/Setup.tsx` | New / edit trip: paste confirmations (AI reads them), check and edit each booking (`LegFields`), name, people, who's waiting, limits. "Try an example trip" loads `trip.json` |
| `web/src/components/app/Console.tsx` | The trip screen: ticket stack, "Something went wrong?" (pick booking, delayed/cancelled), what breaks, **Find a way through** (what you need + real search links + "I found one" form), options checked by the engine, "Compare with AI", approve, save as my trip, drafted actions. Example trip also gets the 4 ready-made disruptions |
| `web/src/lib/recover.ts` | Real-trip logic, no imports from the UI: dates (`weekOf`, `toMin`, `toLocal`), `reportScenario`, `needOf` (the gap to fill), `strategies` (search links), `withFound` (what the traveller found → plans), `applyPlan`, drafts ↔ trip |
| `web/src/lib/store.ts` | The trip in `localStorage` (`domino.trip.v1`), `useSaved()` |
| `web/src/lib/schema.ts` | zod shapes for trips/scenarios the browser sends to `/api/agent` |
| `web/src/app/api/parse/route.ts` | Pasted confirmations → draft bookings (Groq JSON mode, validated). Needs `GROQ_API_KEY`; without it the form says to add bookings by hand |
| `web/src/components/app/ui.tsx` | Panel, Field, Button, input styles |
| `web/src/components/app/Plans.tsx` | Ranked recovery options (Best / Backup / Risky) and the ruled-out list |
| `web/src/components/app/Actions.tsx` | Drafted bookings, refunds, DGCA claim and messages, each to approve or copy |
| `web/src/components/app/FlipText.tsx` | Split-flap text for times and the airline status |
| `web/src/components/app/Ticket.tsx` | One booking drawn as a paper ticket with a stub and a rubber stamp (LATE, MISSED, AT RISK, NEW, KEPT) |
| `web/src/components/app/useAgent.ts` | Reads the agent's NDJSON stream into state |
| `web/src/components/StrandedChat.tsx` | 1/2/3 chat, CSS-only animation, runs the engine client-side |
| `web/scripts/check-engine.ts` | Self-check of the demo story: `npm run check` |

## Times
Every time is minutes from 00:00 on the Monday of the trip's week (`trip.week`), so `fmt` always shows the right weekday. `parseConstraints(text, tripStart)` puts "by 9am Tuesday" on the first Tuesday of the trip.

## Real trips: no fake inventory
Live airline/train inventory needs paid APIs, so Domino never invents options. It works out the gap ("KSR Bengaluru → Mysuru, after 23:00, before Tue 08:30"), gives prefilled searches (Google Flights, IRCTC, Google Maps drive time, Uber, redBus, Booking.com), and the traveller enters what they found. The engine checks each one against the chain and their limits; the AI compares them on request.

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
Motion (`motion/react`) everywhere except stranded mode. Ticket stack: stamps thump in at an angle, new tickets print in from the top, the selected option tilts slightly, times flip like a departure board. Ticket CSS (`.tk`, `.stamp`, `.tk-print`) is in `globals.css`. `MotionConfig reducedMotion="user"` in `Providers.tsx` respects OS settings. Page transitions in `app/template.tsx`.

## Deployment
Auto-deploy: https://nyxdevhack.vercel.app. Vercel project `nyxdevhack` (Nihal's `nova` team), linked to the GitHub repo, root directory `web`. Every push to `main` goes to production; other branches get preview links.
Manual: https://domino-nyx.vercel.app. Vercel project `domino-nyx` on Raahil's account. Redeploy with `cd web`, then `npx vercel deploy --prod`.
Env vars: `GROQ_API_KEY` (and optionally `GROQ_MODEL`) in project settings.

Related: [[Domino Overview]], [[Changelog]]
