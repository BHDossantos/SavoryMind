import { NextRequest, NextResponse } from "next/server";
import { stripeClient, isWebhookConfigured } from "@/lib/billing/stripe-client";
import { db } from "@/lib/db/client";
import {
  findWorkspaceByStripeCustomer,
  setBillingState,
} from "@/lib/billing/workspace-repo";
import { dispatchEvent } from "@/lib/billing/webhook-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isWebhookConfigured()) {
    return NextResponse.json(
      { error: "Webhook not configured" },
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

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json(
      { error: "Could not read body" },
      { status: 400 },
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: `Webhook signature verification failed: ${
          e instanceof Error ? e.message : "unknown"
        }`,
      },
      { status: 400 },
    );
  }

  const result = dispatchEvent(event);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[stripe webhook] ${result.log}`);
  }

  if (result.patch && (result.workspaceId || result.stripeCustomerId)) {
    let workspaceId = result.workspaceId;
    if (!workspaceId && result.stripeCustomerId) {
      const ws = await findWorkspaceByStripeCustomer(
        db(),
        result.stripeCustomerId,
      );
      workspaceId = ws?.workspaceId ?? null;
    }
    if (workspaceId) {
      try {
        await setBillingState(db(), workspaceId, result.patch);
      } catch (e) {
        // Log + still 200 so Stripe doesn't hammer us forever.
        console.error("[stripe webhook] DB write failed:", e);
      }
    } else {
      console.warn(
        `[stripe webhook] no workspace for customer ${result.stripeCustomerId}`,
      );
    }
  }

  return NextResponse.json({ received: true });
}
