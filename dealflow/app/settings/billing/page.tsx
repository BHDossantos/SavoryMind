"use client";

import Link from "next/link";
import { useState } from "react";
import { useBillingSource } from "@/lib/client/use-billing";
import { apiPortal } from "@/lib/client/billing";
import { PLAN_DISPLAY } from "@/lib/billing/plan";

export default function BillingSettingsPage() {
  const { data, authed, isLoading, error } = useBillingSource();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!authed) {
    return (
      <div className="card p-8 text-center text-sm text-slate-600">
        Please <Link href="/login" className="underline">log in</Link> to view
        billing.
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">Loading…</div>
    );
  }
  if (error) {
    return (
      <div className="card border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        Couldn&rsquo;t load billing: {error.message}
      </div>
    );
  }

  const tier = data.effectiveTier;
  const billing = data.billing;
  const display = PLAN_DISPLAY[tier];

  async function manage() {
    setBusy(true);
    setActionError(null);
    try {
      const { url } = await apiPortal();
      window.location.href = url;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Portal failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-slate-600">
          Plan, payment, and invoices.
        </p>
      </header>

      {billing.status === "past_due" && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your last invoice failed to charge. Stripe will retry — update your
          payment method in the customer portal to avoid losing access.
        </div>
      )}

      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Current plan
            </div>
            <div className="mt-1 text-xl font-semibold">{display.label}</div>
            <div className="text-sm text-slate-500">{display.tagline}</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Status: {billing.status}</div>
            <div>Seats: {billing.seatCount}</div>
            {billing.currentPeriodEnd && (
              <div>
                Renews{" "}
                {new Date(billing.currentPeriodEnd).toLocaleDateString("en-IE")}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {tier === "free" ? (
            <Link href="/pricing" className="btn-primary">
              See plans
            </Link>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={manage}
              disabled={busy || !billing.stripeCustomerId}
            >
              {busy ? "Opening portal…" : "Manage subscription"}
            </button>
          )}
          <Link href="/pricing" className="btn-ghost">
            Change plan
          </Link>
        </div>

        {actionError && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {actionError}
          </div>
        )}
      </section>

      <section className="card p-5 text-sm text-slate-600">
        <h2 className="font-semibold text-slate-900">Limits on your plan</h2>
        <ul className="mt-3 space-y-1.5">
          <li>
            Saved deals:{" "}
            <strong>
              {data.limits.maxDeals === null
                ? "unlimited"
                : data.limits.maxDeals}
            </strong>{" "}
            (used {data.dealCount})
          </li>
          <li>
            Claude AI analysis:{" "}
            <strong>{data.limits.aiAnalysis ? "included" : "not included"}</strong>
          </li>
        </ul>
      </section>
    </div>
  );
}
