import { describe, expect, it } from "vitest";
import {
  canCreateDeal,
  canRunAIAnalysis,
  effectiveTier,
  PLAN_LIMITS,
} from "../plan";
import type { BillingState, PlanStatus, PlanTier } from "../types";

function billing(
  tier: PlanTier,
  status: PlanStatus = "active",
): BillingState {
  return {
    workspaceId: "ws_x",
    tier,
    status,
    seatCount: 1,
    currentPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
}

describe("effectiveTier", () => {
  it("returns the real tier for active subscriptions", () => {
    expect(effectiveTier(billing("pro"))).toBe("pro");
    expect(effectiveTier(billing("team"))).toBe("team");
    expect(effectiveTier(billing("free"))).toBe("free");
  });

  it("treats trialing and past_due as still-paying for gating purposes", () => {
    expect(effectiveTier(billing("pro", "trialing"))).toBe("pro");
    expect(effectiveTier(billing("pro", "past_due"))).toBe("pro");
  });

  it("drops back to free on canceled / incomplete", () => {
    expect(effectiveTier(billing("pro", "canceled"))).toBe("free");
    expect(effectiveTier(billing("team", "incomplete"))).toBe("free");
  });
});

describe("canCreateDeal", () => {
  it("free tier allows up to 3 deals", () => {
    expect(canCreateDeal(billing("free"), 0).ok).toBe(true);
    expect(canCreateDeal(billing("free"), 2).ok).toBe(true);
    const blocked = canCreateDeal(billing("free"), 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("deal_limit");
      expect(blocked.limit).toBe(3);
      expect(blocked.currentTier).toBe("free");
    }
  });

  it("pro tier has no deal cap", () => {
    expect(canCreateDeal(billing("pro"), 999).ok).toBe(true);
  });

  it("canceled pro behaves like free at the boundary", () => {
    const blocked = canCreateDeal(billing("pro", "canceled"), 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.currentTier).toBe("free");
  });
});

describe("canRunAIAnalysis", () => {
  it("blocks free tier", () => {
    const blocked = canRunAIAnalysis(billing("free"));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe("ai_not_in_plan");
  });

  it("allows pro and team", () => {
    expect(canRunAIAnalysis(billing("pro")).ok).toBe(true);
    expect(canRunAIAnalysis(billing("team")).ok).toBe(true);
  });

  it("blocks pro that has been canceled", () => {
    expect(canRunAIAnalysis(billing("pro", "canceled")).ok).toBe(false);
  });
});

describe("PLAN_LIMITS sanity", () => {
  it("paid tiers are uncapped", () => {
    expect(PLAN_LIMITS.pro.maxDeals).toBe(Number.POSITIVE_INFINITY);
    expect(PLAN_LIMITS.team.maxDeals).toBe(Number.POSITIVE_INFINITY);
  });
  it("free tier has AI off", () => {
    expect(PLAN_LIMITS.free.aiAnalysis).toBe(false);
  });
});
