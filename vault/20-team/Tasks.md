---
type: note
tags: [team, tasks]
created: 2026-10-20
updated: 2026-10-20
summary: Task board. Move items between sections and add your name.
---
# Tasks

## Doing

## To do
- [ ] Add `GROQ_API_KEY` to `web/.env.local` and run the demo with the live AI
- [ ] Add `GROQ_API_KEY` in the `nyxdevhack` Vercel project settings, then redeploy
- [ ] Pick one live link for judges: `nyxdevhack.vercel.app` (auto-deploys) or `domino-nyx.vercel.app` (manual)
- [ ] Fill in names and areas in [[Team]]
- [ ] Rehearse the [[Demo Script]] twice, time it
- [ ] More scenarios: strike notice, weather diversion, denied boarding (DGCA 200%/400% compensation)
- [ ] Test the app on a real phone (Safari + Chrome), fix anything that clips
- [ ] Set `GROQ_API_KEY` in Vercel and test "Read my bookings" with real confirmation emails (IndiGo, IRCTC, Booking.com)
- [ ] Later: live flight status API to detect delays automatically (step 4, skipped for the MVP)
- [ ] Later: let users reorder bookings in the setup form (hotels sort to the end of their check-in day)
- [ ] Optional polish: torn-ticket animation when a broken ticket is replaced (in the preview CSS as `.tk.torn`)
- [ ] Optional: shorten the agent log wording for non-technical viewers
- [ ] Native APK (later, after the shortlist)

## Done
- [x] Real product MVP: own trip, report, real searches, engine-checked options, send drafts (Nihal, 2026-10-20)
- [x] Full product at `/` in the ticket stack look, landing page removed (Nihal, 2026-10-20)
- [x] Next.js app, engine, 4 scenarios, agent with offline fallback (Raahil, 2026-10-20)
- [x] Landing page, demo console, stranded mode with motion (Raahil, 2026-10-20)
- [x] Vault, changelog hook, README (Raahil, 2026-10-20)
- [x] Deployed to https://domino-nyx.vercel.app (Raahil, 2026-10-20)
- [x] Auto-deploy on push: Vercel project `nyxdevhack` linked to the repo, live at https://nyxdevhack.vercel.app (Nihal, 2026-10-20)
- [x] Agent switched from Claude to Groq free tier (Nihal, 2026-10-20)
