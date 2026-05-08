# Plan 5-1 — Summary

**Status:** ✅ Done

## What changed

- Added `vitest@^2.1` and `@vitest/coverage-v8@^2.1` as devDependencies.
- Added `npm test`, `npm run test:watch`, `npm run test:coverage` scripts.
- Created `vitest.config.ts` with manual `@/*` alias resolution (dropped
  `vite-tsconfig-paths` after it failed to load — ESM-only package fights the
  CJS config loader; manual alias is one fewer dep with the same result).
- Created 8 named `DealInput` fixtures in `lib/__fixtures__/deals.ts`
  covering every business type and the documented edge cases.
- Created `lib/scoring.test.ts` with **18 tests, 28 individual assertions**
  across `calculateFinancials`, `detectRisks`, `calculateOffer`,
  `calculateROI`, and the composed `analyze`.

## Bug found and fixed

`calculateScore` defaulted location/growth qualitative scores via
`safe(d.locationQuality) * 10 || 50`, which silently treated an explicit
`0` input as "unset" and returned 50. The
`extremeQualitativeLow` fixture caught it. Fix in `lib/scoring.ts`: use the
nullish coalescer (`d.locationQuality ?? 5`) to distinguish "unset" from "0".

## Verify-block results

- ✅ `npm test` runs and passes (18/18)
- ✅ More than 25 individual assertions
- ✅ No NaN in zeroRevenue fixture
- ✅ `paybackYears == 99` for unprofitableBar
- ✅ `rent_critical` flag present for highRentGym
