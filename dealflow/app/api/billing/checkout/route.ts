import { NextRequest, NextResponse } from "next/server";
import { stripeClient, isStripeConfigured } from "@/lib/billing/stripe-client";
import { priceIdForTier, pricesConfigured } from "@/lib/billing/prices";
import { AuthError, jsonError, requireSession } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import {
  getBillingState,
  setBillingState,
} from "@/lib/billing/workspace-repo";
import type { PlanTier } from "@/lib/billing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !pricesConfigured()) {
    return NextResponse.json(
      {
        error:
          "Billing is not configured on this server. See STRIPE-SETUP.md.",
      },
      { status: 503 },
    );
  }
  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe client unavailable" },
      { status: 503 },
    );
  }

  try {
    const ctx = await requireSession();
    let body: { tier?: PlanTier; seatCount?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    if (body.tier !== "pro" && body.tier !== "team") {
      return NextResponse.json(
        { error: "tier must be 'pro' or 'team'" },
        { status: 400 },
      );
    }
    const tier = body.tier;
    const quantity =
      tier === "team" ? Math.max(1, Math.floor(body.seatCount ?? 1)) : 1;

    const state = await getBillingState(db(), ctx.workspaceId);
    if (!state) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Reuse the workspace's Stripe customer if we already have one.
    let customerId = state.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.email ?? undefined,
        metadata: { workspace_id: ctx.workspaceId },
      });
      customerId = customer.id;
      await setBillingState(db(), ctx.workspaceId, {
        stripeCustomerId: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: ctx.workspaceId,
      line_items: [
        {
          price: priceIdForTier(tier),
          quantity,
        },
      ],
      success_url: `${appUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/pricing?from=checkout`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { workspace_id: ctx.workspaceId, tier },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
