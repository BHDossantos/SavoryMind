# State

## Current position

- **Branch:** `claude/dealflow-ai-setup-WTRdF`
- **Phases done:** 1, 2, 3, 4, 5, 6
- **Build:** ✅ `npm run build` clean, 12 routes
- **Tests:** ✅ 51 passing across 6 files via `npm test` (Vitest + PGlite)
- **CI:** GitHub Actions workflow on `claude/dealflow-**` and PRs (added Phase 5)
- **Next gate:** Start Phase 7 (frontend migrates from localStorage to the new API)

## Active sellability roadmap

See `SELLABILITY-ROADMAP.md`. ICP locked to **search funders / micro-PE**;
repo strategy is **(ii) monorepo + legacy disclaimer**, with split at
Phase 13. Authorization walls at Phases 8 (Stripe), 9 (hosting/observability),
13 (repo creation).

## Key decisions

- **D1.** Built DealFlow as a self-contained Next.js app under `dealflow/` rather than retrofitting the existing SavoryMind codebase. SavoryMind is a different product; mixing them would block both.
- **D2.** localStorage for v1 persistence (Phases 1–5); migrating to Postgres in Phase 7. The v1 path validated the scoring/UX before infra commitment.
- **D3.** Rule-based scoring engine first; AI is additive in Phase 4.
- **D4.** AI uses `claude-opus-4-7` with adaptive thinking + json_schema + cache_control.
- **D5.** EUR formatting and EU-conservative industry multiples. Multi-region is a v2 (R25).
- **D6.** Attachments stored base64 in localStorage with 2 MB / 5 MB guards. Phase 7 keeps the jsonb column but a future S3-backed attachments service is a candidate after Phase 9.
- **D7.** All planning artifacts live under `dealflow/.planning/` (NOT root `.planning/` — that belongs to SavoryMind).
- **D8.** Test framework is **Vitest** with manual `@/*` alias resolution.
- **D9.** Tests cover deterministic + DB-repo + auth logic. UI components stay covered by manual UAT until v2.
- **D10.** **ORM is Drizzle** + node-postgres. `lib/db/migrations/0000_initial.sql` is hand-written and kept in sync with `lib/db/schema.ts`; the migration runner applies SQL files via the `_migrations` ledger.
- **D11.** **Auth is NextAuth v5 (Auth.js)** with JWT session strategy and a Credentials provider. Split into `auth.config.ts` (edge-safe, used by middleware) + `auth.ts` (server, with DB access).
- **D12.** **One workspace per user at signup**. `workspaceMembers` table already exists so the Team tier in Phase 8 is a data-only change.
- **D13.** **PGlite in-process Postgres for tests** — keeps the test suite Docker-free in CI; the production driver is `pg` against Docker locally and managed Postgres in production.
- **D14.** **ICP locked: search funders / micro-PE** — drives Phase 11 design.
- **D15.** **Repo strategy: monorepo + legacy disclaimer** (Strategy ii) — top-level README clarifies SavoryMind is unmaintained; Phase 13 plans the split.

## Open blockers

None within the current authorization scope.

## Risks watching

- **`AUTH_SECRET` must be set in production.** Currently falls back to a dev-only placeholder. Phase 9 deployment step will require a real secret; documented in `.env.example`.
- **PGlite vs node-postgres parity.** We stuck to standard SQL with no Postgres extensions, so the test harness is faithful. Risk: any future use of a Postgres-only feature (e.g. `LISTEN/NOTIFY`, `pgvector`) will need a different test path.
- **No live UAT yet for Phase 6.** Build + tests pass; click-through against a real running stack is the Phase 7 UAT.
- **AI feature still unverified end-to-end in a browser.** Carry-over from Phase 4.

## Threads / follow-ups

- **T1.** Validate conservative industry multiples against broker comps before non-EU launch.
- **T2.** Extract scoring engine into a framework-agnostic package once the backend stabilizes (Phase 12+).
- **T3.** Decide caching strategy for AI narratives — cache by deal hash on the server so re-clicks are free.
- **T4.** Email verification + password reset (Phase 8 — needs email provider).
- **T5.** Rate limiting on auth endpoints (Phase 9).

## Seeds (forward-looking, low-priority)

- **S1.** Multi-tenant: per-broker workspace with shared deal libraries. Triggers when first broker user requests it.
- **S2.** "Compare against your portfolio" — show how a new deal stacks against the user's saved deals on each axis. Triggers after Phase 7.
- **S3.** Switch to Neon HTTP driver if/when we deploy any route to Vercel Edge.
