# Domino

**One delay shouldn't break your whole trip.** An AI agent for travel disruption recovery, by Team NYX for Devhack Sahyadri.

Domino treats a trip as a chain of linked bookings. When one link breaks, it shows the ripple, sees it coming before the airline announces it, repairs the whole chain within the traveller's own limits, and drafts the refunds, DGCA compensation claim and messages, ready to approve.

**Live:** https://nyxdevhack.vercel.app (auto-deploys from `main`)

**Continuing the work?** Read [`vault/10-project/Handoff.md`](vault/10-project/Handoff.md) first: where we left off and what to pick up next.

## Run it

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. `/` asks for your trip: paste booking confirmations (needs `GROQ_API_KEY`) or add them by hand, or press "Try an example trip". Your trip is saved in the browser. `/stranded` is the low-battery chat mode (example trip).

To use the AI, copy `web/.env.example` to `web/.env.local` and set `GROQ_API_KEY` (free at console.groq.com). It reads pasted bookings and explains options. Without a key you add bookings by hand and the built-in planner explains options.

`npm run check` verifies the engine still produces the demo story.

## Layout

```
web/     Next.js app (engine, agent, UI). Native app can go in mobile/ later.
vault/   Obsidian vault: project notes, decisions, tasks, changelog
.githooks/pre-commit   requires a vault changelog entry with every code change
```

Read `vault/Home.md` first, or open `vault/` as an Obsidian vault.

## Team workflow

1. After cloning, run once: `git config core.hooksPath .githooks`
2. Every commit that touches `web/` must add an entry to `vault/30-log/Changelog.md`. Update any note that describes what you changed.
3. Claim tasks in `vault/20-team/Tasks.md`.
