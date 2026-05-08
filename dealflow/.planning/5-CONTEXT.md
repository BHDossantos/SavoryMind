# Phase 5 — Context

**Goal.** Lock the deterministic logic (scoring engine, CSV export, LOI
template) behind unit tests so any future refactor — especially the v2
backend rewrite — can move with confidence.

**Decisions** (from discuss):

| #  | Decision        | Choice                                                                                              |
| -- | --------------- | --------------------------------------------------------------------------------------------------- |
| C1 | Test framework  | **Vitest** — native ESM, no babel config, fast in TS/Next.js                                        |
| C2 | Test scope      | **`lib/scoring.ts`, `lib/csv.ts`, `lib/loi.ts`** — pure functions only                              |
| C3 | Excluded        | `lib/storage.ts` (needs jsdom + localStorage mocks; covered by manual UAT), `lib/format.ts` (Intl)  |
| C4 | Dataset         | **~8 synthetic fixture deals** covering every business type + edge cases                            |
| C5 | Test layout     | **Co-located** `lib/scoring.test.ts` etc.                                                           |
| C6 | CI              | **`npm test` script + GitHub Actions on `claude/dealflow-*` branches**                              |
| C7 | Coverage gate   | **Track-only**, no enforced threshold (avoid v1 bikeshedding)                                       |
| C8 | Components      | **Not tested** — manual UAT covers UI                                                               |

**Edge cases the dataset must hit** (drives golden fixtures):

- Healthy restaurant near benchmark ratios (baseline)
- Gym with high rent ratio (>20%) → critical risk flag
- Unprofitable bar (negative net profit) → critical flag, ROI = ∞
- Owner-dependent salon (dependency = 9) → high-risk flag, fair value discounted
- Highly seasonal café (seasonality = 8) → medium risk flag
- Zero-revenue placeholder → no division by zero, ratios = 0
- Qualitative all-10 → max location/growth scores
- Qualitative all-0 → minimum scores, no negative outputs

**Out of scope for Phase 5.** Component testing, integration testing of the
`/api/ai-analysis` route (would require mocking the Anthropic SDK or a real
key), and snapshot tests for LOI text.
