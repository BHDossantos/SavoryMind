# Phase 06 — Slotly rebrand + GSD adoption

**Status:** in_progress
**Commits:**
- `834821a chore(slotly): rename availablenow -> slotly` — directory rename via `git mv`
- `96513b3 chore(slotly): update brand strings to Slotly` — content edits
- this commit — `.planning/` artifacts + migration kit

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

## Open questions

- Q-04 — should we run `npx get-shit-done-cc@latest` inside `slotly/` to install the official GSD slash commands and agent definitions? Currently we hand-rolled the planning files to match the framework's structure without installing the toolchain. Hand-rolled docs are framework-compatible but the user won't have `/gsd-plan-phase` etc. available until the installer runs.

## Verified

- Backend imports cleanly post-rename: 38 routes, `app.title == "Slotly API"`
- Frontend `next build` clean post-rename
- All planning files committed under `slotly/.planning/`

## What's next

Phase 07 — Auto-fill cancellations. The infra is in place (notifications + refunds); next phase wires up "broadcast a freed slot to recent searchers."
