/**
 * Idempotent Stripe product/price seeder.
 *
 *   npm run stripe:seed
 *
 * Requires STRIPE_SECRET_KEY in env (or .env.local). Looks for existing
 * products tagged with metadata.dealflow_tier=<tier>. Reuses if found;
 * creates otherwise. Writes resolved IDs to lib/billing/prices.json.
 */
import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import Stripe from "stripe";

loadEnv({ path: ".env.local" });
loadEnv();

const PRICES_JSON_PATH = path.join(
  __dirname,
  "..",
  "lib",
  "billing",
  "prices.json",
);

interface SeedConfig {
  tier: "pro" | "team";
  productName: string;
  description: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
}

const SEED: SeedConfig[] = [
  {
    tier: "pro",
    productName: "DealFlow Pro",
    description:
      "Unlimited deals, AI investment analysis, attachments, pipeline.",
    amount: 2900,
    currency: "eur",
    interval: "month",
  },
  {
    tier: "team",
    productName: "DealFlow Team",
    description:
      "Everything in Pro plus shared workspaces (priced per seat).",
    amount: 9900,
    currency: "eur",
    interval: "month",
  },
];

async function findExistingProduct(stripe: Stripe, tier: string) {
  // Stripe Search API requires Test mode allow-listing on some accounts.
  // Fall back to listing if Search 4xxs.
  try {
    const result = await stripe.products.search({
      query: `metadata['dealflow_tier']:'${tier}' AND active:'true'`,
      limit: 5,
    });
    return result.data[0] ?? null;
  } catch {
    // Linear scan — fine for accounts with O(10) products.
    for await (const product of stripe.products.list({
      active: true,
      limit: 100,
    })) {
      if (product.metadata?.dealflow_tier === tier) return product;
    }
    return null;
  }
}

async function findExistingPrice(
  stripe: Stripe,
  productId: string,
  cfg: SeedConfig,
) {
  for await (const price of stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  })) {
    const matches =
      price.unit_amount === cfg.amount &&
      price.currency === cfg.currency &&
      price.recurring?.interval === cfg.interval;
    if (matches) return price;
  }
  return null;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local before running this script.",
    );
    console.error("See STRIPE-SETUP.md for the full walkthrough.");
    process.exit(1);
  }

  const mode = key.startsWith("sk_live_")
    ? "LIVE"
    : key.startsWith("sk_test_")
      ? "TEST"
      : "UNKNOWN";
  console.log(`Running in ${mode} mode.`);
  if (mode === "LIVE") {
    console.log("Hit Ctrl+C in the next 3 seconds to abort.");
    await new Promise((r) => setTimeout(r, 3000));
  }

  const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });

  const out = JSON.parse(fs.readFileSync(PRICES_JSON_PATH, "utf8"));

  for (const cfg of SEED) {
    console.log(`\n[${cfg.tier}]`);
    let product = await findExistingProduct(stripe, cfg.tier);
    if (product) {
      console.log(`  reuse product ${product.id} (${product.name})`);
    } else {
      product = await stripe.products.create({
        name: cfg.productName,
        description: cfg.description,
        metadata: { dealflow_tier: cfg.tier },
      });
      console.log(`  create product ${product.id}`);
    }

    let price = await findExistingPrice(stripe, product.id, cfg);
    if (price) {
      console.log(`  reuse price   ${price.id}`);
    } else {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: cfg.amount,
        currency: cfg.currency,
        recurring: { interval: cfg.interval },
        metadata: { dealflow_tier: cfg.tier },
      });
      console.log(`  create price  ${price.id}`);
    }

    out[cfg.tier] = {
      productId: product.id,
      priceId: price.id,
      amount: cfg.amount,
      currency: cfg.currency,
      interval: cfg.interval,
    };
  }

  fs.writeFileSync(PRICES_JSON_PATH, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${PRICES_JSON_PATH}`);
  console.log(
    "\nNext: commit lib/billing/prices.json so production matches dev.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
