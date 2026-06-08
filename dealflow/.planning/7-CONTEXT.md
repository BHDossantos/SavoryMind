# Phase 7 — Context

**Goal.** Move every frontend read and write from `lib/storage.ts`
(localStorage) to the `/api/deals` endpoints shipped in Phase 6. Logged-in
users get cloud-persisted deals. Unauthenticated visitors stay on
localStorage so the marketing/demo path still works without an account.
A one-time import flow lets a visitor's local deals follow them into
their workspace after signup.

## Decisions

| #   | Decision                                  | Choice                                                                                                                       |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| C1  | Client cache library                      | **SWR 2.x** — small, used widely in Next.js, native suspense + revalidation, optimistic mutations                              |
| C2  | Data layer entry point                    | **One file `lib/client/deals.ts`** exposing typed fetchers + a single `useDealsSource()` hook that hides API-vs-localStorage |
| C3  | Auth detection                            | **`useSession()` from next-auth/react** in the hook; SWR key is `null` when unauth so the API is never called                  |
| C4  | Unauthenticated UX                        | localStorage stays the source of truth; banner on dashboard encourages signup but does not gate any feature                  |
| C5  | DealInput → API serialization             | Direct JSON; numeric fields stay numeric, date columns come back as ISO strings (matches existing `Deal.createdAt: string`)   |
| C6  | Mutation pattern                          | Action functions (`createDealAction`, `updateDealAction`, etc.) are async, branch on `authed`, return the canonical `Deal`     |
| C7  | Revalidation after mutation               | Call `mutate()` from SWR after every action so the UI catches up without a full reload                                       |
| C8  | Optimistic updates                        | Skip in Phase 7 — wait for real perf complaints. Pessimistic is correct and simpler.                                          |
| C9  | Import-from-localStorage flow             | **Dashboard banner** when authed + localStorage has deals. Button POSTs each, clears localStorage on success, revalidates.    |
| C10 | Component-level mutations (Attachments, AIAnalysis, Pipeline status) | Move to the same action layer. Components stop reaching into `dealsRepo` directly.                            |
| C11 | Tests                                     | Pure tests for the API client (mock `fetch`). Component re-render tests stay out of scope (per Phase 5 / C8).                |
| C12 | localStorage `seedDemoIfEmpty`            | Only fires for unauthenticated visitors. Logged-in users see an empty dashboard until they create their first deal.          |

## Edge cases

- **First load while authed, no deals yet** → SWR returns `[]` quickly; dashboard shows the empty state with "+ New Deal" CTA.
- **Logout while on a protected page** → Middleware already redirects; no extra client handling.
- **Logged in with localStorage deals from a prior unauthenticated session** → Import banner appears (C9). User can dismiss or import.
- **Importing fails partway** → Track which IDs succeeded; only those clear from localStorage. Surface a count summary, no full rollback (the API is idempotent enough — each call creates a new row).
- **API 500 during a mutation** → Surface the error inline at the call site (the deal page already has error states). No global toast yet (Phase 10 nice-to-have).

## Out of scope

- Server components for protected pages (Phase 11 or later optimization).
- Real-time updates (websockets) — Phase 12 or later.
- Optimistic UI for create/update.
- Component re-render testing.
