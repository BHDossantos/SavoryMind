# Plan 7-2 — Summary

**Status:** ✅ Done

## What shipped

Every UI surface now reads through `useDealsSource()` / `useDealSource(id)` and writes through the action layer:

- **`app/page.tsx`** (Dashboard): SWR-backed list, loading + error states, amber banner for unauth visitors pointing at signup, CSV export still works against `deals` array.
- **`app/deals/new`**: awaits `createDealAction`, surfaces errors inline, revalidates SWR before routing to detail page.
- **`app/deals/[id]`**: source via `useDealSource(id)`. Status, priority, and delete go through the action layer with a per-op `busy` lock; after each mutation `refresh()` updates the SWR cache.
- **`app/deals/[id]/edit`**: identical pattern — read via hook, save via `updateDealAction`.
- **`app/pipeline`**: kanban moves use `setStatusAction` with a per-card `busy-id` lock to disable buttons during the API roundtrip.
- **`app/compare`**: read via `useDealsSource`; new loading + error states.
- **`app/loi/[id]`**: read via `useDealSource(id)`; new loading + error states.

Components:
- **`AIAnalysis.tsx`** now takes `{ deal, authed, onChange }`; `setNarrative` and `clearNarrative` go through the action layer; `onChange()` revalidates after mutation.
- **`Attachments.tsx`** same pattern with `busy` tracked across the read-as-data-URL + API roundtrip; copy adapts ("Stored on your account." vs "...in your browser.").

`dealsRepo` is no longer imported in any UI file — it survives only inside `lib/client/*` (unauth fallback) and is grandfathered into `components/ImportLocalBanner.tsx` (Plan 7-3).

## Verify-block results

- ✅ `npm run build` clean — 14 routes, bundle sizes shifted as expected (each page now ships SWR runtime)
- ✅ `npm test` still 59 passing across 7 files (existing tests are pure; no regressions)
- ✅ Type-check passes across all migrated pages
- ⏳ Click-through against a running stack is in the Phase 7 UAT below
