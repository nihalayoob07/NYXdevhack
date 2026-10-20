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
- The site **is the product** now. `/` is the ticket stack app (`web/src/components/app/TripApp.tsx`), built from `10-project/design/ticket-stack-preview.html` (open it in a browser, use the "Ticket stack" tab; "Frozen glass" was dropped).
- Full flow works with real engine data for all 4 scenarios: home → notification → alert → Fix my trip → options → review → booking → back on track. Verified in a headless browser on desktop and phone width, no console errors.
- `npm run check`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` all pass.
- Old landing page and demo console are deleted (in git history before this commit if needed). `/demo` redirects to `/`. `/stranded` is unchanged.
- Agent: Groq free tier, falls back to the built-in planner without `GROQ_API_KEY` (the app shows "Built-in planner" in that case).

## Pick up here
1. Open https://nyxdevhack.vercel.app on a phone and run the [[Demo Script]]. Fix anything that clips or overflows.
2. Make sure `GROQ_API_KEY` is set in Vercel and do one live AI run through the app.
3. See [[Tasks]] for the rest. Keep to essentials, it's an MVP for the shortlist.

## Things to know
- Ticket styles live in `web/src/app/globals.css` under `.paper` (light only, on purpose). The stamp and screen angles match the preview; don't flatten them.
- The engine (`web/src/lib/engine.ts`) owns every number. The app only formats what it returns. See [[Architecture]].
- Every commit touching `web/` needs a [[Changelog]] entry (pre-commit hook: `git config core.hooksPath .githooks`).
