# State

## Current position

- **Branch:** `claude/dealflow-ai-setup-WTRdF`
- **Last commit:** `6d4fc7b` (Phase 4 — AI deal analysis via Claude Opus 4.7)
- **Phases done:** 1, 2, 3, 4
- **Build:** ✅ `npm run build` clean, 8 routes
- **Next gate:** `/gsd-discuss-phase 5` — awaiting user pick from ROADMAP §Phase 5 candidates.

## Key decisions

- **D1.** Built DealFlow as a self-contained Next.js app under `dealflow/` rather than retrofitting the existing SavoryMind codebase. SavoryMind is a different product; mixing them would block both.
- **D2.** localStorage for v1 persistence. Ships in days not weeks. Lets us validate the scoring/UX before committing to infra.
- **D3.** Rule-based scoring engine first; AI is additive in Phase 4. Deterministic, testable, free at the edges; AI is differentiation, not foundation.
- **D4.** AI uses `claude-opus-4-7` with `thinking: {type: "adaptive"}`, `output_config: { effort: "high", format: { type: "json_schema", schema } }`, and `cache_control: {type: "ephemeral"}` on the system prompt. Latest most-capable model; structured output guarantees parseable narrative; cache_control no-ops harmlessly while system prompt is below the 4K-token cache threshold.
- **D5.** EUR formatting and EU-conservative industry multiples in `lib/multiples.ts`. Multi-region is a v2 (R25).
- **D6.** Attachments stored base64 in localStorage with 2 MB / file and 5 MB total guards. Trades simplicity for quota constraints; will move to S3-equivalent in v2.
- **D7.** All planning artifacts live under `dealflow/.planning/` (NOT root `.planning/` — that belongs to SavoryMind).

## Open blockers

None.

## Risks watching

- **localStorage quota** (~5–10 MB browser-dependent) limits attachments. Mitigated by per-file/total guards. Real-world breaks will be visible to the user and reversible.
- **`ANTHROPIC_API_KEY` not set** → `/api/ai-analysis` returns 503 with a clear message. Documented in `.env.example`. Acceptable for v1.
- **No automated tests yet.** Scoring engine (`lib/scoring.ts`) is the highest-value test target — must be covered before any backend rewrite (R26).
- **AI feature unverified end-to-end in a browser.** The build passes and the route compiles, but I have not run the dev server with a real `ANTHROPIC_API_KEY` and clicked through. Pre-Phase-5 verify item.

## Threads / follow-ups

- **T1.** Validate the conservative industry multiples in `lib/multiples.ts` against actual broker comps (Portugal/EU first) before any non-EU launch.
- **T2.** Once R19 lands, pull the scoring engine into a tested, framework-agnostic package so the same logic powers a future API and a future React Native client.
- **T3.** Decide caching strategy for AI narratives in v2 — do we cache by deal hash on the server so re-clicks are free?

## Seeds (forward-looking, low-priority)

- **S1.** Multi-tenant: per-broker workspace with shared deal libraries. Triggers when first broker user requests it.
- **S2.** "Compare against your portfolio" — show how a new deal stacks against the user's saved deals on each axis. Triggers after R19.
