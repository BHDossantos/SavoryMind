import { NextResponse } from "next/server";
import { AuthError, jsonError, requireSession } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import {
  countDealsForWorkspace,
  getBillingState,
} from "@/lib/billing/workspace-repo";
import { effectiveTier, PLAN_LIMITS } from "@/lib/billing/plan";
import { isStripeConfigured } from "@/lib/billing/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireSession();
    const state = await getBillingState(db(), ctx.workspaceId);
    if (!state) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const dealCount = await countDealsForWorkspace(db(), ctx.workspaceId);
    const tier = effectiveTier(state);
    const limits = PLAN_LIMITS[tier];

    return NextResponse.json({
      billing: state,
      effectiveTier: tier,
      dealCount,
      limits: {
        maxDeals: Number.isFinite(limits.maxDeals) ? limits.maxDeals : null,
        aiAnalysis: limits.aiAnalysis,
      },
      stripeConfigured: isStripeConfigured(),
    });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
