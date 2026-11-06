# Frontend dependency remediation — 5 November 2026

This candidate starts at main `346bb6910d8bb9df525ff52bc8d550de7d44bc73`.
It changes frontend dependency declarations and the committed lockfile only;
the API outage, backend dependencies and mobile dependencies are separate work.

## Selected changes

| Package | Previous lock | Candidate lock | Reason |
| --- | --- | --- | --- |
| next | 15.5.22 | 15.5.28 | Stay on Next 15/React 18 while applying the published image-optimization and server-action fixes |
| sharp | 0.34.5 | 0.35.5 | Update vulnerable image-processing libraries; this is within Next 15.5.28's declared optional dependency range |
| postcss | 8.5.12 | 8.5.32 | Patched source-map loading; retain the existing PostCSS override strategy |
| dompurify | 3.4.13 | 3.4.17 | Patch sanitization defects in the existing PostHog dependency tree |
| source-map-js | 1.2.1 | 1.2.2 | Patch indexed-source-map denial of service |
| fflate | 0.4.8 | 0.4.9 | Patch malformed ZIP64 handling |
| brace-expansion | 1.1.14 | 1.1.21 | Patch development-tree advisories without changing major version |
| js-yaml | 3.15.0 | 3.15.2 | Patch development-tree parser advisories |
| postcss-selector-parser | 6.1.2 | 6.1.5 | Patch parser advisories without upgrading Tailwind |
| browserslist | 4.28.2 | 4.29.5 | Refresh compatible patched tooling |
| baseline-browser-mapping | 2.10.20 | 2.11.35 | Refresh compatible patched tooling |

NextAuth and PostHog versions are unchanged: their original production audit
entries were inherited from vulnerable dependencies. No force upgrade, React
major upgrade, new auth implementation or test-framework downgrade was used.
Sharp requires Node >=20.9.0; local validation used Node 24.19.0. Verify the
actual hosted Node runtime before release. The Dockerfile uses Node 20 and CI
uses Node 22, but neither proves the native Render Node service runtime.

Primary release references:
- https://github.com/vercel/next.js/releases/tag/v15.5.28
- https://github.com/cure53/DOMPurify/releases/tag/3.4.17

## Reconciliation with existing work

This overlaps frontend dependency PRs #142 (Next), #139 (Sharp/Next), #148
(DOMPurify), #141 (source-map-js), #115 (fflate), #127 (brace-expansion), #121
(js-yaml), #118 (baseline-browser-mapping) and #117 (Browserslist). Do not merge
all of them mechanically. Review the final lockfile and supersede/reconcile the
overlapping drafts. #140's Tailwind major upgrade was intentionally not used;
the parser patch works with the existing Tailwind major.

The separate API-client write-retry commit and store-readiness PR #151 are not
included. Existing branches/PRs were not modified.

## Audit limits

The initial production-only npm audit reported 8 findings (3 critical, 3 high,
2 moderate). The candidate production-only audit reports **zero**. The full
development + production audit retains **6 low entries**, all arising from
`deepmerge` through Jest configuration. Registry metadata lists 4.3.1 as the
latest deepmerge version; npm's suggested resolution is a Jest downgrade to
25.1.0. That incompatible downgrade was not applied. This is not a claim of
zero vulnerabilities in the whole repository or proof of non-exploitability.

No PR was opened, no branch was pushed, no merge/deploy/provider action occurred.
Production remains unchanged. Deployment, live auth acceptance and real image
optimization acceptance remain release gates.

## Validation of the final lockfile

- `npm ci --ignore-scripts`: passed using the committed lockfile.
- `npm test -- --runInBand`: 88 tests / 13 suites passed.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: passed, including compilation,
  type/lint stage and generation of all 74 static pages.
- `npm audit --omit=dev --json`: zero production findings.
- `npm audit --json`: six low entries in the development-only deepmerge/Jest
  chain; zero critical/high/moderate entries.
- Sharp native smoke: encode and decode 4x4 PNG, AVIF and WebP images passed.
- Local production server: `/` and `/login` returned 200. `/api/auth/providers`
  returned 500 with NextAuth `NO_SECRET` because this isolated environment has
  no production auth secret. No credentials were generated and no external
  OAuth request was made. Authenticated production acceptance is not claimed.
- `git diff --check`: passed.

Logs and audit JSON are retained in
`/workspace/scratch/app-audit-2026-11-05/security-*` for this work session.
