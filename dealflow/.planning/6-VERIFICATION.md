# Phase 6 — Verification

## Phase goal recap

Replace browser-local persistence with a Postgres-backed multi-tenant API
behind authentication. After this phase the **API** exists end-to-end;
the **frontend** still talks to localStorage and gets migrated in Phase 7.

## Did the codebase deliver?

| Goal                                                       | Status |
| ---------------------------------------------------------- | ------ |
| Postgres schema with users, workspaces, deals              | ✅     |
| Drizzle ORM with type-safe queries                         | ✅     |
| Hand-written initial migration kept in sync with schema    | ✅     |
| Idempotent migration runner (`npm run db:migrate`)         | ✅     |
| Auth (signup + login + middleware + session)               | ✅     |
| Auth.js v5 with split edge-safe config                     | ✅     |
| Deal API CRUD scoped by workspace                          | ✅     |
| Cross-tenant access returns 404 (no info leak)             | ✅     |
| Tests cover the security-critical invariants               | ✅     |
| `npm run build` clean                                      | ✅ 12 routes |
| Existing tests still pass                                  | ✅ 28 → 51 |
| Phase 7 frontend migration deferred per C14                | ✅     |

## Test totals

```
Test Files  6 passed (6)
     Tests  51 passed (51)
  Duration  ~10s (PGlite migrations dominate)
```

Files:
- `lib/scoring.test.ts` (18) — from Phase 5
- `lib/csv.test.ts` (4) — from Phase 5
- `lib/loi.test.ts` (6) — from Phase 5
- `lib/db/deals-repo.test.ts` (4) — workspace scope enforcement
- `lib/auth/__test__/signup.test.ts` (8) — signup, hashing, credential verification
- `lib/api/__test__/validation.test.ts` (11) — payload validation

## Live verification still required (UAT in Phase 7)

The following are correct by construction (build + tests pass) but not
yet exercised against a real running dev server:

- `npm run db:up` → docker-compose Postgres comes up healthy on 5433
- `npm run db:migrate` → applies `0000_initial.sql` cleanly
- Signup form creates a user + workspace and logs them in
- Login form authenticates and redirects to `/`
- `/api/deals` GET returns `[]` for a fresh account
- Hitting `/deals` while logged out redirects to `/login?from=/deals`
- Middleware doesn't trip the edge runtime (pg import isolation)

Wired into Phase 7's UAT step.

## Authorization walls (touched but not blocked)

Phase 6 stays inside the **no authorization wall** zone — everything
ships against local Docker Postgres + dev `AUTH_SECRET`. Phase 7 stays
the same. Phase 8 (Stripe) is the first phase that needs user credentials.

## Follow-ups for later phases

- **F1.** Email verification flow — deferred to Phase 8 (needs an email provider).
- **F2.** Password reset — deferred to Phase 8.
- **F3.** Rate limiting on `/api/auth/signup` and `/login` POSTs — deferred to Phase 9.
- **F4.** Multi-member workspaces (Team tier) — schema is ready (`workspaceMembers` exists), wiring deferred to Phase 8.
- **F5.** Audit-log table for sensitive ops — Phase 9 (observability).
