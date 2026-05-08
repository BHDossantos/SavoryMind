# Plan 5-1 — Vitest setup + scoring engine tests

<plan>
  <name>Vitest scaffolding and scoring engine coverage</name>
  <wave>1</wave>
  <depends_on>none</depends_on>
  <files>
    <write>dealflow/package.json</write>
    <write>dealflow/vitest.config.ts</write>
    <write>dealflow/lib/__fixtures__/deals.ts</write>
    <write>dealflow/lib/scoring.test.ts</write>
  </files>
  <action>
    1. Add devDependencies: vitest@^2.0, @vitest/coverage-v8@^2.0, vite-tsconfig-paths@^5.
    2. Add scripts: test, test:watch, test:coverage.
    3. Create vitest.config.ts using vite-tsconfig-paths so @/* resolves the same as Next.js.
    4. Create 8 named DealInput fixtures in lib/__fixtures__/deals.ts.
    5. Cover scoring.ts: calculateFinancials, detectRisks, calculateOffer, calculateROI,
       calculateScore, analyze. Each test asserts specific numeric outputs and risk codes,
       not loose ranges. Edge cases: zero revenue, negative profit, qualitative all-10/all-0.
  </action>
  <verify>
    - `npm test` runs and passes
    - At least 25 individual assertions across analyze + sub-functions
    - No NaN in any computed field for the zeroRevenue fixture
    - paybackYears == 99 for unprofitableBar
    - rent_critical flag present for highRentGym
  </verify>
  <done>
    - All scoring functions covered by at least one assertion
    - All 8 fixtures used in at least one test
    - `npm test` green locally
  </done>
</plan>
