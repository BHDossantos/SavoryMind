# Phase 06 — Slotly rebrand + GSD adoption

**Status:** done
**Commits:**
- `834821a chore(slotly): rename availablenow -> slotly` — directory rename via `git mv`
- `96513b3 chore(slotly): update brand strings to Slotly` — content edits
- `e982fd7 docs(slotly): GSD planning + migration kit` — `.planning/` artifacts + migration kit
- this commit — official GSD installer (`.claude/`) + config reconciliation

## Goal

Pivot the project from working name "AvailableNow" to "Slotly" (the chosen GitHub repo at `BHDossantos/Slotly`). Adopt the GSD planning workflow so future phases run inside a structured spec → research → plan → execute → verify cycle. Prepare a clean migration to the new repo.

## Outcome

- `availablenow/` → `slotly/` directory rename, history preserved by `git mv` (100% similarity).
- Brand strings updated: API title, frontend layout `<title>`, Nav header, provider onboarding heading, "no reviews yet" copy, email signoff, fallback notification subject, seeded admin/customer email domains, default `NOTIFICATIONS_FROM_EMAIL/NAME`, DB filename, npm package name, localStorage keys, all Python logger names.
- Feature names kept intact: the "Available now" search filter and its query param `available_now` / variable `availableNow` are the **feature**, not the brand. Untouched.
- New `slotly/.planning/` directory matching the GSD framework:
  - `config.json` — GSD workflow config
  - `PROJECT.md` — vision (one-line brief, target market, decisions locked)
  - `REQUIREMENTS.md` — IDed v1 requirements (REQ-001..067, all `done`) + IDed v2 backlog (REQ-100..161)
  - `ROADMAP.md` — phases mapped to commits
  - `STATE.md` — current position, 13 logged decisions, open questions
  - `phases/01-SUMMARY.md` … `phases/05-SUMMARY.md` — retroactive summaries of shipped work
  - `phases/06-SUMMARY.md` — this file
- `MIGRATION.md` + `migrate-to-slotly.sh` script for pushing `slotly/` to `BHDossantos/Slotly` via `git filter-repo --subdirectory-filter`. The Claude Code session does **not** have GitHub MCP access to that repo (scope is locked to `bhdossantos/savorymind`); the repo owner runs the script.

## Decisions logged

No new technical decisions — meta-phase.

## Open questions resolved

- ✅ Q-04 — installed `npx get-shit-done-cc@latest --claude --local` (v1.38.5). Dropped 85 commands, 33 agents, 11 hooks, and the framework's `.claude/get-shit-done/` data dir (~4 MB total). `.planning/config.json` reconciled to the official schema (`mode`, `granularity`, nested `workflow` / `planning` / `parallelization` / `gates` / `safety` / `hooks` / `agent_skills`).

## New open question (Q-05)

GSD wants a project-root `CLAUDE.md` with marker-bounded sections sourced from `PROJECT.md` plus `STACK.md`, `CONVENTIONS.md`, `ARCHITECTURE.md` (the latter three don't exist). The framework's intended generator is `gsd-tools generate-claude-md` from `@gsd-build/sdk`, which the local installer skipped (`Skipping SDK check for local install — install @gsd-build/sdk globally if you need /gsd-* CLI support.`). Decision deferred — the user can either install the SDK globally (`npm i -g @gsd-build/sdk`) and run `gsd-tools generate-claude-md`, or we hand-write a minimal `CLAUDE.md` next phase.

## Verified

- Backend imports cleanly post-rename: 38 routes, `app.title == "Slotly API"`
- Frontend `next build` clean post-rename
- All planning files committed under `slotly/.planning/`

## What's next

Phase 07 — Auto-fill cancellations. The infra is in place (notifications + refunds); next phase wires up "broadcast a freed slot to recent searchers."
