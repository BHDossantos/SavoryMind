# Phase 7 — Research

## Source of truth on each page (Phase 6 status)

| Page / Component                     | Touches `dealsRepo` directly? | Mutation operations                                                  |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------- |
| `app/page.tsx` (Dashboard)           | Yes                           | `seedDemoIfEmpty`, `list` + window event subscription                |
| `app/deals/new/page.tsx`             | Yes                           | `create`                                                              |
| `app/deals/[id]/page.tsx`            | Yes                           | `get`, `setStatus`, `setPriority`, `remove`                          |
| `app/deals/[id]/edit/page.tsx`       | Yes                           | `get`, `update`                                                       |
| `app/pipeline/page.tsx`              | Yes                           | `list`, `setStatus`                                                   |
| `app/compare/page.tsx`               | Yes                           | `list`                                                                |
| `app/loi/[id]/page.tsx`              | Yes                           | `get`                                                                 |
| `components/AIAnalysis.tsx`          | Yes                           | `setNarrative`, `clearNarrative`                                      |
| `components/Attachments.tsx`         | Yes                           | `addAttachment`, `removeAttachment`                                   |

All consumers funnel through `dealsRepo`, so a one-time wrapper swap is
feasible — components don't need to change shape if we keep the action
surface identical.

## SWR shape

- `useSWR(key, fetcher)` — key is `null` to skip fetching (when unauth).
- `mutate(key)` revalidates. `mutate(key, newData, { revalidate: false })` updates the cache without a network roundtrip.
- For list endpoints, a single key `"/api/deals"` is enough; per-item keys could be `["/api/deals", id]` if we ever do real-time per-deal subscriptions.
- Configure `SWRConfig` once in `components/Providers.tsx` with `revalidateOnFocus: true`, `dedupingInterval: 2000`.

## Data shape parity

- API returns `{ deals: DbDeal[] }`. `DbDeal` has the same business
  fields the existing `Deal` type uses, plus `workspaceId`, `createdById`,
  `updatedAt`. The frontend doesn't need those — pass through anyway,
  components ignore extras.
- Dates: API JSON has ISO strings, existing `Deal.createdAt` is `string`.
  Lines up — no conversion needed.
- `attachments` / `aiNarrative` come back as parsed JSON objects (Postgres
  jsonb → JSON string in response → parsed by `Response.json()`).

## Import-from-localStorage flow

1. On the dashboard, after auth resolves, read `dealsRepo.list()` from the
   client. If `> 0`, render a banner: "You have N deals in this browser.
   Import them to your account?"
2. On click: iterate, POST each to `/api/deals` with the deal fields.
   Skip the localStorage `id` (server generates a new one) and `createdAt`
   (server uses `now()`). Other fields go through as-is.
3. On 2xx: collect the new deal IDs; on success of the batch, call
   `dealsRepo` to remove the imported ones from localStorage; revalidate
   SWR.
4. On any partial failure: surface count, keep the failed deals in
   localStorage (the user can retry).

## Risks

- **`seedDemoIfEmpty` polluting logged-in users.** Mitigation: only call
  it from the unauthenticated branch of `useDealsSource()`.
- **SWR and Suspense interaction with the auth status.** First render
  while `status === "loading"` can't show definitive empty-state. We hold
  on a loading skeleton until auth resolves.
- **Double-source confusion during the import flow.** While the import
  is in progress, the dashboard could briefly show both localStorage
  copies and server-side copies. Fix: hide the local copy as soon as the
  banner is dismissed/started, then show the server result after refresh.

## Test strategy

- Pure tests against the API client wrappers (mock `globalThis.fetch`):
  - `listDeals()` returns parsed `Deal[]`
  - `createDealAction(authed: true, ...)` POSTs JSON and returns the new deal
  - `createDealAction(authed: false, ...)` writes to localStorage (mock window)
  - Error path: non-2xx → throws with the body's `error` field
