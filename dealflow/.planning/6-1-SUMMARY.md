# Plan 6-1 — Summary

**Status:** ✅ Done — commit `Phase 6-1`

## What shipped

- **Deps:** `drizzle-orm`, `pg`, `bcryptjs`, `@auth/drizzle-adapter`, `next-auth@5.0.0-beta.25`. Dev: `drizzle-kit`, `@types/pg`, `@types/bcryptjs`, `@electric-sql/pglite`, `dotenv`, `tsx`.
- **`docker-compose.yml`** — Postgres 16 on port 5433 with a named volume + healthcheck. `npm run db:up` / `db:down` / `db:reset`.
- **Schema (`lib/db/schema.ts`)** — NextAuth standard tables (users, accounts, sessions, verificationTokens) plus DealFlow tables (workspaces, workspaceMembers, deals). Deals' `attachments` and `aiNarrative` are typed jsonb. Foreign keys cascade-delete; indexes on `(workspaceId, createdAt)` and `(userId)`.
- **`lib/db/migrations/0000_initial.sql`** — hand-written initial migration kept in sync with the schema. Applied by `lib/db/migrate.ts` (`npm run db:migrate`) with an idempotent `_migrations` ledger.
- **`lib/db/client.ts`** — node-postgres `Pool` + Drizzle handle behind a hot-reload-safe `globalThis` singleton. Throws a clear runtime error if `DATABASE_URL` is unset.
- **`lib/db/users-repo.ts`** — `createUserWithDefaultWorkspace` runs user + workspace + ownership in a single transaction. `verifyCredentials` always runs `bcrypt.compare` (against a junk hash if the user is missing) so there's no timing side channel that leaks email validity.
- **`lib/db/deals-repo.ts`** — list/get/create/update/delete, all scoped by `workspaceId`. Cross-tenant access returns `null` / `false` — no information leak.
- **PGlite test harness (`lib/db/__test__/pglite-harness.ts`)** — in-process Postgres so tests don't need Docker. Boots a fresh DB per test and runs the migrations.
- **4 new repo tests** verify workspace scope on every mutation path.

## Verify-block results

| Check                                          | Status |
| ---------------------------------------------- | ------ |
| `npm run db:up` brings up Postgres on 5433     | ⏭ Local only (Docker available; documented in README) |
| `npm test` passes including new repo tests     | ✅ 32/32 |
| Drizzle schema compiles under tsc              | ✅     |
| Migration SQL applied via PGlite without error | ✅     |
| Workspace-scope test demonstrates enforcement  | ✅ Test confirms a deal in workspace A is invisible from workspace B |
