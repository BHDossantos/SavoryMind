# Phase 7 — Verification

## Phase goal recap

Move every frontend read/write from `lib/storage.ts` (localStorage) to the
`/api/deals` endpoints shipped in Phase 6. Logged-in users get
cloud-persisted deals. Unauthenticated visitors keep the local-only
experience. A first-login banner imports any pre-auth deals into the new
workspace.

## Did the codebase deliver?

| Goal                                                            | Status |
| --------------------------------------------------------------- | ------ |
| Async data layer (API client + actions + hooks)                | ✅     |
| SWR cache + revalidation                                        | ✅     |
| Pages migrated off `dealsRepo`                                  | ✅ 7 pages, 2 components |
| Components migrated off `dealsRepo`                             | ✅     |
| Unauth fallback still works (localStorage path)                 | ✅ Branch on `useSession().status` |
| First-login import banner                                       | ✅     |
| `seedDemoIfEmpty` only fires for unauth visitors                | ✅     |
| `npm run build` clean                                           | ✅ 14 routes |
| `npm test` green                                                | ✅ 63 passing across 8 files |

## Test totals

```
Test Files  8 passed (8)
     Tests  63 passed (63)
  Duration  ~13s (PGlite migrations dominate; client tests are fast)
```

Coverage by surface:
- `lib/scoring.test.ts` (18) — Phase 5
- `lib/csv.test.ts` (4) — Phase 5
- `lib/loi.test.ts` (6) — Phase 5
- `lib/db/deals-repo.test.ts` (4) — Phase 6
- `lib/auth/__test__/signup.test.ts` (8) — Phase 6
- `lib/api/__test__/validation.test.ts` (11) — Phase 6
- `lib/client/__test__/api.test.ts` (8) — Phase 7
- `lib/client/__test__/import.test.ts` (4) — Phase 7

## Pending live UAT (runs against `npm run db:up` + `npm run dev`)

These are end-to-end checks that the build + tests can't fully cover:

1. `npm run db:up && npm run db:migrate` — Postgres up + migration applied
2. `/signup` → create account → redirected to `/`, empty dashboard
3. `+ New Deal` → fill form → redirected to detail → analysis renders
4. Refresh — deal still there (Postgres persistence)
5. Pipeline column move persists across refresh
6. Edit deal → save → updated values rendered
7. Delete deal → returns to dashboard, gone
8. Sign out → `/` shows unauth banner pointing at signup
9. Add a deal while signed out → goes to localStorage
10. Sign back in → ImportLocalBanner shows N deals → click Import → deals appear in workspace, localStorage emptied
11. Hit `/api/deals` directly while signed out → 401
12. Sign in as User B, request a deal id from User A's workspace → 404 (no info leak)

These are scripted in **`PHASE7-UAT.md`** for whoever runs the live test (deferred to the next live session).

## Authorization walls (touched but not blocked)

Still in the "no authorization wall" zone — everything runs against local
Docker Postgres + dev `AUTH_SECRET`. **Phase 8 (Stripe billing)** is the
first phase that needs user-side credentials.

## Follow-ups added to STATE

- **T6** Fix the `storage.ts.list()` comparator (`a.createdAt < b.createdAt ? 1 : -1` violates strict weak ordering for equal values; replace with `b.createdAt.localeCompare(a.createdAt)`).
- **T7** Add a bulk-import endpoint so the importer is a single POST when deal counts grow.
- **T8** Migrate aiNarrative + attachments along with the deal during import (currently `apiCreateDeal` only takes `DealInput`; attached blobs stay in localStorage).
