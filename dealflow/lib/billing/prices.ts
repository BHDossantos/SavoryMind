import pricesJson from "./prices.json";
import type { PlanTier } from "./types";

export interface PriceConfig {
  productId: string;
  priceId: string;
  amount: number; // smallest unit (cents)
  currency: string;
  interval: "month" | "year";
}

export const PRICES: Record<Exclude<PlanTier, "free">, PriceConfig> = {
  pro: pricesJson.pro as PriceConfig,
  team: pricesJson.team as PriceConfig,
};

export function priceIdForTier(tier: Exclude<PlanTier, "free">): string {
  return PRICES[tier].priceId;
}

/**
 * Reverse lookup used by the webhook handler: given a Stripe Price ID,
 * which tier does it belong to? Returns null when the id isn't recognized
 * (which happens before the seed script has run or in tests).
 */
export function tierForPriceId(priceId: string): PlanTier | null {
  if (!priceId) return null;
  if (PRICES.pro.priceId && PRICES.pro.priceId === priceId) return "pro";
  if (PRICES.team.priceId && PRICES.team.priceId === priceId) return "team";
  return null;
}

export function pricesConfigured(): boolean {
  return Boolean(PRICES.pro.priceId) && Boolean(PRICES.team.priceId);
}
