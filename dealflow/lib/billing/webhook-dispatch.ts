/**
 * Pure dispatcher for Stripe webhook events. Given a parsed event +
 * helpers, returns a Patch describing what should be written to the
 * workspaces table. The route handler does the actual DB write so this
 * module stays test-friendly without a live DB.
 */
import type Stripe from "stripe";
import type { BillingPatch } from "./workspace-repo";
import type { PlanStatus, PlanTier } from "./types";
import { tierForPriceId } from "./prices";

export interface DispatchResult {
  workspaceId: string | null;
  stripeCustomerId: string | null;
  patch: BillingPatch | null;
  /** Human-readable summary for logs. */
  log: string;
}

interface DispatchDeps {
  /**
   * Tier-from-price-id override (defaults to the live `tierForPriceId`).
   * Tests inject a synthetic mapping.
   */
  tierForPrice?: (priceId: string) => PlanTier | null;
}

const STATUS_MAP: Record<string, PlanStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  paused: "canceled",
};

function subscriptionToPatch(
  sub: Stripe.Subscription,
  tierLookup: (id: string) => PlanTier | null,
): BillingPatch {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? "";
  const tier = tierLookup(priceId) ?? "free";
  const patch: BillingPatch = {
    stripeSubscriptionId: sub.id,
    planTier: tier,
    planStatus: STATUS_MAP[sub.status] ?? "incomplete",
    seatCount: item?.quantity ?? 1,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null,
  };
  return patch;
}

export function dispatchEvent(
  event: Stripe.Event,
  deps: DispatchDeps = {},
): DispatchResult {
  const tierLookup = deps.tierForPrice ?? tierForPriceId;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId =
        (session.client_reference_id as string | null) ?? null;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      // The subscription details land via the subscription.* events that
      // follow — here we just attach the customer to the workspace.
      const patch: BillingPatch = customerId
        ? { stripeCustomerId: customerId }
        : {};
      return {
        workspaceId,
        stripeCustomerId: customerId,
        patch,
        log: `checkout.session.completed for workspace=${workspaceId} customer=${customerId}`,
      };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : null;
      return {
        workspaceId: null,
        stripeCustomerId: customerId,
        patch: subscriptionToPatch(sub, tierLookup),
        log: `${event.type} customer=${customerId} tier=${subscriptionToPatch(sub, tierLookup).planTier}`,
      };
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : null;
      return {
        workspaceId: null,
        stripeCustomerId: customerId,
        patch: {
          planTier: "free",
          planStatus: "canceled",
          stripeSubscriptionId: null,
          seatCount: 1,
          currentPeriodEnd: null,
        },
        log: `customer.subscription.deleted customer=${customerId} → free`,
      };
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      return {
        workspaceId: null,
        stripeCustomerId: customerId,
        patch: { planStatus: "active" },
        log: `invoice.paid customer=${customerId}`,
      };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      return {
        workspaceId: null,
        stripeCustomerId: customerId,
        patch: { planStatus: "past_due" },
        log: `invoice.payment_failed customer=${customerId} → past_due`,
      };
    }

    default:
      return {
        workspaceId: null,
        stripeCustomerId: null,
        patch: null,
        log: `ignored event type ${event.type}`,
      };
  }
}
