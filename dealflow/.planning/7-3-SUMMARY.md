# Plan 7-3 — Summary

**Status:** ✅ Done

## What shipped

- **`lib/client/import.ts`** — `importLocalDealsToApi(localDeals)` iterates and POSTs each to `/api/deals`. Removes successful ones from localStorage as they land. Failures are returned with the original `localId`, name, and error message so the UI can surface them. No bulk endpoint yet — N round trips, acceptable for typical local volumes (≤ 20).
- **`components/ImportLocalBanner.tsx`** — visible only when `status === "authenticated"` AND `dealsRepo.list().length > 0`. "Import N deals" button runs the import, mutates `dealsKey` to refresh the saved-deals grid below, and surfaces a result message. "Not now" persists to `sessionStorage.dealflow.importBanner.dismissed.v1`.
- **`app/page.tsx`** mounts `<ImportLocalBanner />` above the KPIs.
- **`jsdom`** added as a dev dep so import-flow tests can use `window.localStorage`.
- **4 new tests** under `lib/client/__test__/import.test.ts` covering: full-success path clears localStorage; partial-failure keeps only the failed deal; empty list is a no-op; field-level API errors surface with the deal name preserved.

## Hiccup

Initial test assumed iteration order based on insertion. `storage.ts.list()` has a buggy comparator (`a.createdAt < b.createdAt ? 1 : -1` — returns `-1` for equal values), which violates strict weak ordering and produces unstable results for equal `createdAt`. Workaround in the test: assert the invariant directly rather than the specific id — *whichever import failed is exactly the one left in localStorage* (`remaining[0].id === result.failed[0].localId`). Filed as **T6** in STATE.md to fix the comparator in a follow-up.

## Verify-block results

- ✅ `npm run build` clean
- ✅ `npm test` green — 59 → 63
- ✅ Banner only renders when authed && localStorage has deals
- ✅ Dismissal persists for the session
