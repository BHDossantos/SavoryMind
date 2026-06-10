import { NextResponse } from "next/server";
import { stripeClient, isStripeConfigured } from "@/lib/billing/stripe-client";
import { AuthError, jsonError, requireSession } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { getBillingState } from "@/lib/billing/workspace-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
    "http://localhost:3000"
  );
}

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured on this server." },
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
    const state = await getBillingState(db(), ctx.workspaceId);
    if (!state?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No subscription yet — upgrade first at /pricing." },
        { status: 400 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: state.stripeCustomerId,
      return_url: `${appUrl()}/settings/billing`,
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
