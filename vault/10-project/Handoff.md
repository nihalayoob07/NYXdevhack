---
type: note
tags: [project, handoff]
created: 2026-10-20
updated: 2026-10-20
summary: Where work stopped and what to pick up next. Read this first when continuing.
---
# Handoff

Last updated by Nihal (with Claude), 2026-10-20.

## Where we left off
- The site **is the product** now. `/` is the full Domino app (`web/src/components/app/Console.tsx`) in the ticket stack look from `10-project/design/ticket-stack-preview.html` (open it in a browser, "Ticket stack" tab; "Frozen glass" was dropped). Stranded mode uses the same look.
- Everything from the original demo is there: bookings as a ticket stack, Send a disruption (4 scenarios), notification, alert with "warned you 41 min before IndiGo", live agent log, limits in your own words, ranked options + ruled out, repaired trip, drafted actions (refunds, DGCA claim, messages). Verified in a headless browser on desktop and phone width: no console errors, no sideways scroll.
- `npm run check`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` all pass.
- The old landing page is deleted (in git history if needed). `/demo` redirects to `/`.
- Agent: Groq free tier, falls back to the built-in planner without `GROQ_API_KEY` (the app shows "Built-in planner" in that case).

## Pick up here
1. Open https://nyxdevhack.vercel.app on a phone and run the [[Demo Script]]. Fix anything that clips or overflows.
2. Make sure `GROQ_API_KEY` is set in Vercel and do one live AI run through the app.
3. See [[Tasks]] for the rest. Keep to essentials, it's an MVP for the shortlist.

## Things to know
- Theme tokens and ticket styles live in `web/src/app/globals.css` (light only, on purpose). `Ticket.tsx` draws one booking. The stamp angles match the preview; keep them.
- The engine (`web/src/lib/engine.ts`) owns every number. The app only formats what it returns. See [[Architecture]].
- Every commit touching `web/` needs a [[Changelog]] entry (pre-commit hook: `git config core.hooksPath .githooks`).
