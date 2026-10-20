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
- `/` is the **real product** (MVP): add your own trip → report what went wrong → see what breaks → search real options → enter what you found → engine checks it → compare with AI → approve → save as my trip → send drafts (WhatsApp / email).
- "Try an example trip" loads the old simulated trip, which also has the 4 ready-made disruptions and stranded mode. Good for a quick judge demo.
- Look and feel: ticket stack theme from `10-project/design/ticket-stack-preview.html`.
- Verified in a headless browser: by-hand trip, delay, cab option, approve, save, reload; example trip with flight cancelled; edit and save; phone width with no sideways scroll. `npm run check`, `tsc`, `eslint`, `build` all pass.
- **Not tested live:** "Read my bookings" (needs `GROQ_API_KEY`; locally it correctly says to add by hand). Test it on Vercel once the key is set.

## Pick up here
1. Set `GROQ_API_KEY` in Vercel, then paste real confirmation emails into "Read my bookings" and check what it gets wrong. Tune the prompt in `web/src/app/api/parse/route.ts`.
2. Run the [[Demo Script]] on a real phone.
3. See [[Tasks]]. Keep to essentials, it's an MVP for the shortlist.

## Things to know
- Real-trip logic is in `web/src/lib/recover.ts`; times are minutes from the Monday of the trip's week (see [[Architecture]]).
- Theme tokens and ticket styles live in `web/src/app/globals.css` (light only, on purpose). `Ticket.tsx` draws one booking. The stamp angles match the preview; keep them.
- The engine (`web/src/lib/engine.ts`) owns every number. The app only formats what it returns. See [[Architecture]].
- Every commit touching `web/` needs a [[Changelog]] entry (pre-commit hook: `git config core.hooksPath .githooks`).
