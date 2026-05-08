# State

## Current position

- **Branch:** `claude/dealflow-ai-setup-WTRdF`
- **Phases done:** 1, 2, 3, 4, 5
- **Build:** ✅ `npm run build` clean, 8 routes
- **Tests:** ✅ 28 passing across 3 files via `npm test` (Vitest)
- **CI:** GitHub Actions workflow added; first run on next push
- **Next gate:** `/gsd-discuss-phase 6` — awaiting user pick from ROADMAP §Phase 6 candidates.

## Key decisions

- **D1.** Built DealFlow as a self-contained Next.js app under `dealflow/` rather than retrofitting the existing SavoryMind codebase. SavoryMind is a different product; mixing them would block both.
- **D2.** localStorage for v1 persistence. Ships in days not weeks. Lets us validate the scoring/UX before committing to infra.
- **D3.** Rule-based scoring engine first; AI is additive in Phase 4. Deterministic, testable, free at the edges; AI is differentiation, not foundation.
- **D4.** AI uses `claude-opus-4-7` with `thinking: {type: "adaptive"}`, `output_config: { effort: "high", format: { type: "json_schema", schema } }`, and `cache_control: {type: "ephemeral"}` on the system prompt. Latest most-capable model; structured output guarantees parseable narrative; cache_control no-ops harmlessly while system prompt is below the 4K-token cache threshold.
- **D5.** EUR formatting and EU-conservative industry multiples in `lib/multiples.ts`. Multi-region is a v2 (R25).
- **D6.** Attachments stored base64 in localStorage with 2 MB / file and 5 MB total guards. Trades simplicity for quota constraints; will move to S3-equivalent in v2.
- **D7.** All planning artifacts live under `dealflow/.planning/` (NOT root `.planning/` — that belongs to SavoryMind).
- **D8.** Test framework is **Vitest** with manual `@/*` alias resolution in `vitest.config.ts`. Originally used `vite-tsconfig-paths` but it's ESM-only and the CJS config loader rejected it; manual alias is one fewer dep with the same behavior.
- **D9.** Tests cover only deterministic logic (`scoring`, `csv`, `loi`). UI components and the AI route stay covered by manual UAT until v2.

## Open blockers

None.

## Risks watching

- **localStorage quota** (~5–10 MB browser-dependent) limits attachments. Mitigated by per-file/total guards. Real-world breaks will be visible to the user and reversible.
- **`ANTHROPIC_API_KEY` not set** → `/api/ai-analysis` returns 503 with a clear message. Documented in `.env.example`. Acceptable for v1.
- **AI feature unverified end-to-end in a browser.** The build passes and the route compiles, but I have not run the dev server with a real `ANTHROPIC_API_KEY` and clicked through. Open UAT item.
- **CI workflow not yet observed running green.** First trigger lands with the Phase 5 commit; verify in the Actions tab after push.

## Threads / follow-ups

- **T1.** Validate the conservative industry multiples in `lib/multiples.ts` against actual broker comps (Portugal/EU first) before any non-EU launch.
- **T2.** Once R19 lands, pull the scoring engine into a tested, framework-agnostic package so the same logic powers a future API and a future React Native client.
- **T3.** Decide caching strategy for AI narratives in v2 — do we cache by deal hash on the server so re-clicks are free?

## Seeds (forward-looking, low-priority)

- **S1.** Multi-tenant: per-broker workspace with shared deal libraries. Triggers when first broker user requests it.
- **S2.** "Compare against your portfolio" — show how a new deal stacks against the user's saved deals on each axis. Triggers after R19.
