import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { dispatchEvent } from "../webhook-dispatch";
import type { PlanTier } from "../types";

const tierForPrice = (id: string): PlanTier | null => {
  if (id === "price_pro") return "pro";
  if (id === "price_team") return "team";
  return null;
};

function evt<T>(type: string, object: T): Stripe.Event {
  return {
    id: "evt_test",
    type,
    object: "event",
    api_version: null,
    created: 0,
    data: { object: object as unknown as Stripe.Event.Data["object"] },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

function subscription(args: {
  status: string;
  priceId: string;
  customer: string;
  quantity?: number;
  periodEnd?: number;
}): Stripe.Subscription {
  return {
    id: "sub_test",
    customer: args.customer,
    status: args.status,
    current_period_end: args.periodEnd ?? Math.floor(Date.now() / 1000) + 86400,
    items: {
      data: [
        {
          price: { id: args.priceId },
          quantity: args.quantity ?? 1,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

describe("dispatchEvent", () => {
  it("checkout.session.completed attaches the customer to the workspace", () => {
    const result = dispatchEvent(
      evt("checkout.session.completed", {
        client_reference_id: "ws_42",
        customer: "cus_42",
      }),
      { tierForPrice },
    );
    expect(result.workspaceId).toBe("ws_42");
    expect(result.stripeCustomerId).toBe("cus_42");
    expect(result.patch?.stripeCustomerId).toBe("cus_42");
  });

  it("subscription.created maps price to tier and copies seats + period end", () => {
    const result = dispatchEvent(
      evt(
        "customer.subscription.created",
        subscription({
          status: "active",
          priceId: "price_team",
          customer: "cus_team",
          quantity: 5,
        }),
      ),
      { tierForPrice },
    );
    expect(result.stripeCustomerId).toBe("cus_team");
    expect(result.patch?.planTier).toBe("team");
    expect(result.patch?.planStatus).toBe("active");
    expect(result.patch?.seatCount).toBe(5);
    expect(result.patch?.stripeSubscriptionId).toBe("sub_test");
    expect(result.patch?.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it("subscription.deleted drops the workspace back to free", () => {
    const result = dispatchEvent(
      evt(
        "customer.subscription.deleted",
        subscription({
          status: "canceled",
          priceId: "price_pro",
          customer: "cus_canc",
        }),
      ),
      { tierForPrice },
    );
    expect(result.patch?.planTier).toBe("free");
    expect(result.patch?.planStatus).toBe("canceled");
    expect(result.patch?.stripeSubscriptionId).toBeNull();
    expect(result.patch?.seatCount).toBe(1);
  });

  it("invoice.paid touches planStatus to active", () => {
    const result = dispatchEvent(
      evt("invoice.paid", { customer: "cus_paid" }),
      { tierForPrice },
    );
    expect(result.patch?.planStatus).toBe("active");
  });

  it("invoice.payment_failed flips status to past_due", () => {
    const result = dispatchEvent(
      evt("invoice.payment_failed", { customer: "cus_fail" }),
      { tierForPrice },
    );
    expect(result.patch?.planStatus).toBe("past_due");
  });

  it("ignores unrecognized event types without throwing", () => {
    const result = dispatchEvent(evt("price.updated", {}), { tierForPrice });
    expect(result.patch).toBeNull();
    expect(result.log).toContain("ignored");
  });

  it("falls back to free when the price id isn't in the table", () => {
    const result = dispatchEvent(
      evt(
        "customer.subscription.created",
        subscription({
          status: "active",
          priceId: "price_unknown",
          customer: "cus_x",
        }),
      ),
      { tierForPrice },
    );
    expect(result.patch?.planTier).toBe("free");
  });

  it("maps past_due status correctly", () => {
    const result = dispatchEvent(
      evt(
        "customer.subscription.updated",
        subscription({
          status: "past_due",
          priceId: "price_pro",
          customer: "cus_pd",
        }),
      ),
      { tierForPrice },
    );
    expect(result.patch?.planStatus).toBe("past_due");
    expect(result.patch?.planTier).toBe("pro");
  });
});
