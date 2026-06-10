import type {
  BillingState,
  GateResult,
  PlanLimits,
  PlanStatus,
  PlanTier,
} from "./types";

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { maxDeals: 3, aiAnalysis: false },
  pro: { maxDeals: Number.POSITIVE_INFINITY, aiAnalysis: true },
  team: { maxDeals: Number.POSITIVE_INFINITY, aiAnalysis: true },
};

/**
 * Some statuses preserve access until the period actually ends (Stripe's
 * grace period). past_due in particular is intentionally kept "active" for
 * gating purposes — the customer sees a banner in the UI but is not booted
 * mid-period.
 */
const ACCESSIBLE_STATUSES: ReadonlySet<PlanStatus> = new Set([
  "active",
  "trialing",
  "past_due",
]);

/**
 * The effective tier accounts for cancellations / incomplete signups by
 * dropping back to free when the subscription isn't really paying.
 */
export function effectiveTier(state: BillingState): PlanTier {
  if (state.tier === "free") return "free";
  if (!ACCESSIBLE_STATUSES.has(state.status)) return "free";
  return state.tier;
}

export function canCreateDeal(
  state: BillingState,
  currentDealCount: number,
): GateResult {
  const tier = effectiveTier(state);
  const limit = PLAN_LIMITS[tier].maxDeals;
  if (currentDealCount < limit) return { ok: true };
  return {
    ok: false,
    code: "deal_limit",
    reason: `Your ${tier} plan is limited to ${limit} deals.`,
    currentTier: tier,
    limit,
  };
}

export function canRunAIAnalysis(state: BillingState): GateResult {
  const tier = effectiveTier(state);
  if (PLAN_LIMITS[tier].aiAnalysis) return { ok: true };
  return {
    ok: false,
    code: "ai_not_in_plan",
    reason: "AI analysis requires a paid plan.",
    currentTier: tier,
  };
}

/** Convenience for the UI: render plan name + a short tagline. */
export const PLAN_DISPLAY: Record<PlanTier, { label: string; tagline: string }> = {
  free: { label: "Free", tagline: "3 deals · core scoring" },
  pro: { label: "Pro", tagline: "Unlimited deals · Claude analysis" },
  team: { label: "Team", tagline: "Per-seat workspaces" },
};
