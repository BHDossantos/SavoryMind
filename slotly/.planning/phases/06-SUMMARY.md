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

## Q-05 resolution — CLAUDE.md + codebase docs

Tried `npm i -g @gsd-build/sdk` (got `gsd-sdk` v0.1.0 — that binary only does plan execution: `run`, `auto`, `init`). The `gsd-tools` binary that runs `docs-init` is bundled with the local install (`.claude/get-shit-done/bin/gsd-tools.cjs`); its available subcommands are `state`, `resolve-model`, `find-phase`, `commit`, `verify-summary`, `verify`, `frontmatter`, `template`, `generate-slug`, `current-timestamp`, `list-todos`, `verify-path-exists`, `config-ensure-section`, `config-new-project`, `init`, `workstream`, `docs-init`. There is no `generate-claude-md` subcommand — the README's reference to it is from a doc that was either renamed or only fires inside `/gsd-` slash-command workflows where the Claude agent does the generation.

Hand-wrote the artifacts the framework expects:
- `.planning/codebase/STACK.md` — runtime, deps, build/run commands
- `.planning/codebase/ARCHITECTURE.md` — backend / frontend layout, key flows, trust boundaries
- `.planning/codebase/CONVENTIONS.md` — code style, auth patterns, stub-mode rule, git, testing-debt note
- `CLAUDE.md` at the project root with all 7 GSD marker-bounded sections (project / stack / conventions / architecture / skills / workflow-enforcement / profile)

The three codebase docs carry the `<!-- generated-by: gsd-doc-writer -->` provenance marker so a future `gsd-codebase-mapper` run can replace them cleanly.

While running `docs-init` to verify, also caught + removed `gates` and `safety` keys from `.planning/config.json` — they're in the framework's starter template but rejected by this version's schema validator. Reconciled to the official `VALID_CONFIG_KEYS` set in `bin/lib/config-schema.cjs`.

## Verified

- Backend imports cleanly post-rename: 38 routes, `app.title == "Slotly API"`
- Frontend `next build` clean post-rename
- All planning files committed under `slotly/.planning/`

## What's next

Phase 07 — Auto-fill cancellations. The infra is in place (notifications + refunds); next phase wires up "broadcast a freed slot to recent searchers."
