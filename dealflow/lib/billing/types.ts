export type PlanTier = "free" | "pro" | "team";

export type PlanStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "trialing"
  | "incomplete";

export interface BillingState {
  workspaceId: string;
  tier: PlanTier;
  status: PlanStatus;
  seatCount: number;
  currentPeriodEnd: string | null; // ISO
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface PlanLimits {
  maxDeals: number; // Infinity for paid tiers
  aiAnalysis: boolean;
}

export type GateCode =
  | "ok"
  | "deal_limit"
  | "ai_not_in_plan"
  | "subscription_inactive";

export type GateResult =
  | { ok: true }
  | {
      ok: false;
      code: Exclude<GateCode, "ok">;
      reason: string;
      currentTier: PlanTier;
      limit?: number;
    };
