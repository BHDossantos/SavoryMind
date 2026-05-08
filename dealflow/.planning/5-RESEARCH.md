# Phase 5 — Research

## Vitest setup in a Next.js 14 + TS project

- Add `vitest`, `@vitest/coverage-v8`. No babel config needed — Vitest reads
  `tsconfig.json` directly.
- Minimal `vitest.config.ts`: `test: { environment: "node", globals: false }`.
  Pure-function tests don't need jsdom.
- Path alias `@/*` already in `tsconfig.json`. Vitest needs the same alias —
  install `vite-tsconfig-paths` so it reuses `tsconfig.json` resolution.
- Add scripts:
  - `test` → `vitest run`
  - `test:watch` → `vitest`
  - `test:coverage` → `vitest run --coverage`

## Test surface — what each module actually exposes

**`lib/scoring.ts`:**
- `calculateFinancials(d)` — pure arithmetic, must handle revenue=0 without NaN
- `detectRisks(d, f)` — returns `RiskFlag[]`; deterministic
- `calculateScore(d, f, risks, offer)` — weighted blend; clamps 0–100
- `calculateOffer(d, f)` — applies industry multiple + risk-adjusted factor
- `calculateROI(d, f)` — must return `paybackYears = 99` for zero/negative EBITDA
- `analyze(d)` — composes all of the above (highest-leverage test target)

**`lib/csv.ts`:**
- `dealsToCsv(deals)` — header order must be stable; quoting must escape commas/newlines/quotes
- `downloadCsv` — DOM-only, untestable in node env, skip

**`lib/loi.ts`:**
- `defaultLoiInput()` — closing date 60 days from now
- `generateLoi(deal, analysis, loiInput)` — text template; verify section
  numbering, suggested-offer interpolation, optional financing-contingency
  block, signature lines

## Golden fixture design

Single shared `lib/__fixtures__/deals.ts` exporting typed `DealInput` objects,
named for what they're testing:

- `healthyRestaurant` — baseline, near benchmarks
- `highRentGym` — rent 22% of revenue → triggers `rent_critical`
- `unprofitableBar` — expenses > revenue
- `ownerDependentSalon` — dependency 9
- `seasonalCafe` — seasonality 8
- `zeroRevenue` — revenue 0, no NaN allowed
- `extremeQualitativeHigh` — all qualitative = 10
- `extremeQualitativeLow` — all qualitative = 0

Each fixture is a `DealInput` (no id, status, createdAt) — the analyze
function operates on the input shape.

## CI workflow

Single GitHub Actions job:
- Trigger: `push` on `claude/dealflow-*` branches and `pull_request` to
  `main`
- Steps: checkout, setup-node 20, `npm ci` in `dealflow/`, `npm test` in
  `dealflow/`
- Path filter so SavoryMind-only changes don't run DealFlow tests

## Risks / unknowns

- Vitest 1.x vs 2.x: pin to `^2.0` (stable; better TS 5.4 support).
- `@vitest/coverage-v8` requires Node ≥ 18.18 for `node:test`-style hooks —
  Actions runs Node 20 by default.
- Existing `next build` does its own TS check; tests are additive, not
  replacing build's typecheck.
