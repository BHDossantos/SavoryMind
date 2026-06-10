# Plan 8-3 — Billing UI: pricing, settings, upgrade prompts

<plan>
  <name>UI surfaces: /pricing, /billing/success, account settings, gate-triggered upgrade prompts</name>
  <wave>3</wave>
  <depends_on>8-1, 8-2</depends_on>
  <files>
    <write>dealflow/app/pricing/page.tsx</write>
    <write>dealflow/app/billing/success/page.tsx</write>
    <write>dealflow/app/settings/billing/page.tsx</write>
    <write>dealflow/components/PlanBadge.tsx</write>
    <write>dealflow/components/UpgradePrompt.tsx</write>
    <write>dealflow/lib/client/billing.ts</write>
    <write>dealflow/lib/client/use-billing.ts</write>
    <write>dealflow/app/page.tsx</write>
    <write>dealflow/app/deals/new/page.tsx</write>
    <write>dealflow/components/AIAnalysis.tsx</write>
    <write>dealflow/app/layout.tsx</write>
  </files>
  <action>
    1. /pricing — three-card layout (Free / Pro €29 / Team €99 per seat).
       Each card lists limits and ships a button:
         - signed out: "Sign up free" → /signup
         - signed in & on lower tier: "Upgrade" → POST /api/billing/checkout
         - signed in & on this tier: "Current plan" disabled
         - keys absent: button disabled with caption "Billing not configured"
       Reads { authed, billing } via useBillingSource() hook (Plan 8-3
       client wrapper around /api/billing/workspace).
    2. /billing/success — post-checkout landing page. Polls
       useBillingSource() (SWR with refreshInterval: 2000) until the tier
       flips from free or 10 seconds elapse. Shows "Activating…" then a
       success state with a "Go to dashboard" CTA.
    3. /settings/billing — for authed users: shows current plan, period
       end, seat count (if team), "Manage subscription" button that POSTs
       to /api/billing/portal and redirects. Banner if planStatus is
       past_due.
    4. components/PlanBadge — small pill ("Free" / "Pro" / "Team") rendered
       in the header next to the user's email. Hidden for unauth.
    5. components/UpgradePrompt — reusable card explaining a feature is
       gated; "Upgrade" → /pricing?from=<source>. Used by new-deal page
       when a free user hits 3, and by AIAnalysis when free.
    6. lib/client/billing.ts — apiCheckout(tier), apiPortal(),
       apiWorkspaceBilling(). Each wraps fetch with DealApiError-style
       errors. Centralized billing SWR key.
    7. lib/client/use-billing.ts — useBillingSource() returning
       { billing, authed, configured, isLoading, error, refresh }.
       SWR-backed when authed; returns a synthetic free-tier default
       when unauth.
    8. app/page.tsx — when authed & free & dealCount >= 3 (we have the
       count locally already), show <UpgradePrompt source="dashboard" />
       above the saved-deals grid. Keep the existing flow otherwise.
    9. app/deals/new — disable submit + show UpgradePrompt if at limit.
       (Server gate is still authoritative; UI is a courtesy.)
    10. components/AIAnalysis — for unauth + free authed users, render the
        UpgradePrompt where the Generate button would go. Pro/Team
        unchanged.
    11. Layout — header gets <PlanBadge /> alongside <AuthMenu />, and a
        "Pricing" nav link visible regardless of auth state.
  </action>
  <verify>
    - npm run build clean
    - npm test still green (no new tests; UI is covered by build + manual UAT)
    - Pricing page renders the three tiers regardless of auth state
    - Upgrade buttons disable cleanly when keys absent
    - PlanBadge shows "Free" for a fresh signup
  </verify>
  <done>
    - All UI committed
    - User can navigate signup → pricing → click upgrade → land on Stripe
      checkout (manual UAT step; covered in summary once keys are pasted)
  </done>
</plan>
