# Agent instructions (Claude Code, Codex, Cursor, etc.)

Three people work on this repo and the Obsidian vault in `vault/` is the shared memory.

- Read `vault/Home.md` and `vault/10-project/Architecture.md` before changing code.
- With every change: add an entry to `vault/30-log/Changelog.md` (date, who, what, why, notes touched), update the note that describes what you changed, and bump its `updated` frontmatter date. Commit the vault change in the same commit. The pre-commit hook enforces the changelog entry.
- Use wikilinks (`[[Note title]]`) between notes and link new notes from `vault/Home.md`.
- The engine (`web/src/lib/engine.ts`) owns every time, price and feasibility check. The LLM only explains. Keep it that way.
- Run `npm run check`, `npx tsc --noEmit` and `npx eslint src` in `web/` before committing.
- `web/AGENTS.md` has Next.js 16 specific notes: read the docs in `node_modules/next/dist/docs/` before using Next APIs.
