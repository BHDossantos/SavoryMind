"use client";

import type { BillingState, PlanTier } from "@/lib/billing/types";

export const billingKey = "/api/billing/workspace";

export interface WorkspaceBillingResponse {
  billing: BillingState;
  effectiveTier: PlanTier;
  dealCount: number;
  limits: { maxDeals: number | null; aiAnalysis: boolean };
  stripeConfigured: boolean;
}

export class BillingApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "BillingApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<BillingApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  const obj = (body ?? {}) as { error?: string };
  return new BillingApiError(
    obj.error ?? `Request failed (${res.status})`,
    res.status,
  );
}

export async function fetchWorkspaceBilling(): Promise<WorkspaceBillingResponse> {
  const res = await fetch(billingKey, { cache: "no-store" });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as WorkspaceBillingResponse;
}

export async function apiCheckout(
  tier: "pro" | "team",
  seatCount = 1,
): Promise<{ url: string }> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tier, seatCount }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as { url: string };
}

export async function apiPortal(): Promise<{ url: string }> {
  const res = await fetch("/api/billing/portal", { method: "POST" });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as { url: string };
}
