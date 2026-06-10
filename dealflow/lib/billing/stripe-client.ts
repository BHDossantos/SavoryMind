import Stripe from "stripe";

let cached: Stripe | null | undefined;

/**
 * Returns a Stripe client if STRIPE_SECRET_KEY is set, otherwise null.
 * Callers (routes, the seed script) branch on null and return 503-style
 * "billing not configured" responses instead of crashing.
 */
export function stripeClient(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Stripe(key, {
    // Pin to a known-stable API version. Update deliberately, not by drift.
    apiVersion: "2025-02-24.acacia",
    appInfo: {
      name: "DealFlow AI",
      version: "0.1.0",
    },
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}
