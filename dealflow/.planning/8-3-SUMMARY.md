# Plan 8-3 — Summary

**Status:** ✅ Done

## What shipped

Three new pages + two new components + a client billing layer. The free tier now has visible gates pointing at `/pricing`; paid tiers get a customer portal.

- `/pricing` — three-card layout (Free / Pro €29 / Team €99 per seat). Reads `useBillingSource()`; CTAs render correctly across four states (unauth → "Sign up free", current plan → disabled "Current plan", lower tier → "Upgrade", billing not configured → disabled with caption). Upgrade button POSTs `/api/billing/checkout`, follows the returned URL.
- `/billing/success` — polls `useBillingSource()` at 2s intervals until `effectiveTier` flips, then shows a celebration state with a "Go to dashboard" CTA. Times out after 15s with a "still processing — refresh" state.
- `/settings/billing` — current plan + status + period end + seat count. Past-due banner if applicable. "Manage subscription" POSTs `/api/billing/portal`. Hides portal CTA if no Stripe customer yet (sends user back to `/pricing`).
- `lib/client/billing.ts` — `BillingApiError` + `apiCheckout` / `apiPortal` / `fetchWorkspaceBilling`.
- `lib/client/use-billing.ts` — `useBillingSource()` SWR-backed for authed users, synthetic free-tier default for unauth so non-account pages can still render. Optional `refreshIntervalMs` for the success-page polling pattern.
- `components/PlanBadge` — small pill (Free/Pro/Team) in the header linking to `/settings/billing`. Hidden for unauth.
- `components/UpgradePrompt` — reusable card + inline variant. Every upgrade CTA flows through a single `source` tag (e.g. `dashboard_limit`, `new_deal_limit`, `ai_analysis_gate`) for later analytics.
- Dashboard now renders `<UpgradePrompt source="dashboard_limit" />` above the saved-deals grid when an authed user is at or over their deal cap.
- New-deal page renders the prompt above the form; the submit handler returns early when at limit so the API doesn't see a doomed POST.
- `AIAnalysis` component renders an inline upgrade prompt where the empty state used to be (for free + unauth); the Generate button changes copy to "Pro feature" and disables.
- Layout: new "Pricing" nav link + `<PlanBadge />` between New Deal and AuthMenu.

## Verify-block results

- ✅ `npm run build` clean — **17 routes total** (4 new UI pages + 4 new API routes since end of Phase 7)
- ✅ `npm test` still 88 passing across 12 files
- ✅ Pricing page renders three tiers regardless of auth state
- ✅ Upgrade buttons disable cleanly when keys absent
- ⏳ Live click-through covered in `8-VERIFICATION.md`'s UAT script (deferred until keys exist)
