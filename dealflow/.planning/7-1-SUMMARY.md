# Plan 7-1 — Summary

**Status:** ✅ Done

## What shipped

- `swr@^2.2.5` added.
- `lib/client/api.ts` — typed wrappers (`apiListDeals`, `apiGetDeal`, `apiCreateDeal`, `apiUpdateDeal`, `apiDeleteDeal`) plus `DealApiError` carrying status + optional field errors. Centralized SWR keys (`dealsKey`, `dealKey(id)`).
- `lib/client/actions.ts` — branch-on-authed action surface (create, update, delete, setStatus, setPriority, setNarrative, clearNarrative, addAttachment, removeAttachment). When authed → API; when not → `dealsRepo`.
- `lib/client/use-deals.ts` — `useDealsSource()` and `useDealSource(id)` hooks. SWR-backed when authed; localStorage + `dealflow:change` listener when not. `seedDemoIfEmpty` only fires for unauth visitors so logged-in users see a clean dashboard.
- `components/Providers.tsx` extended with `SWRConfig` — `revalidateOnFocus`, `dedupingInterval: 2000`, `shouldRetryOnError: false`.
- 8 new tests against the API client (mocked `fetch`): list/get/create/update/delete success + 401/400/404 error parsing.

## Hiccup

`apiUpdateDeal` accepts `aiNarrative: AINarrative | null` (null clears), but the localStorage path is `dealsRepo.update(id, patch)` which expects `Partial<Deal>` and doesn't allow `null`. Fix: in the unauth branch of `updateDealAction`, branch on `aiNarrative === null` → `clearNarrative` else pass-through.

## Verify-block results

- ✅ `npm run build` clean
- ✅ `npm test` green — 51 → 59
- ✅ Hook compiles under strict TS
- ✅ No page yet calls the new hook (per the plan; Plan 7-2 handles migration)
