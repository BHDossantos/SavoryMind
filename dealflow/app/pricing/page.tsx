"use client";

import Link from "next/link";
import { useState } from "react";
import { useBillingSource } from "@/lib/client/use-billing";
import { apiCheckout } from "@/lib/client/billing";

interface Plan {
  tier: "free" | "pro" | "team";
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
}

const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    price: "€0",
    cadence: "forever",
    blurb: "Kick the tires on three deals.",
    features: [
      "3 saved deals",
      "Rule-based scoring + risk flags",
      "Pipeline + LOI generator",
      "CSV export",
    ],
    cta: "Get started",
  },
  {
    tier: "pro",
    name: "Pro",
    price: "€29",
    cadence: "/ month",
    blurb: "For serious buyers running multiple deals.",
    features: [
      "Unlimited saved deals",
      "Claude-generated investment thesis",
      "Negotiation playbook & DD checklist",
      "Document attachments",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
  },
  {
    tier: "team",
    name: "Team",
    price: "€99",
    cadence: "/ seat / month",
    blurb: "Shared workspace for search funds and small PE shops.",
    features: [
      "Everything in Pro",
      "Shared workspace (coming Phase 11)",
      "Per-seat billing",
      "Single-sign-on (soon)",
    ],
    cta: "Upgrade to Team",
  },
];

export default function PricingPage() {
  const { data, authed, isLoading } = useBillingSource();
  const currentTier = data.effectiveTier;
  const stripeConfigured = data.stripeConfigured;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upgrade(tier: "pro" | "team") {
    if (!authed) {
      window.location.href = `/signup?from=pricing`;
      return;
    }
    setBusy(tier);
    setError(null);
    try {
      const { url } = await apiCheckout(tier);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold">Plans & pricing</h1>
        <p className="mt-2 text-sm text-slate-600">
          Free works forever for a handful of deals. Pro is where the AI lives.
        </p>
        {!stripeConfigured && authed && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Billing is not configured on this server. Upgrade buttons are
            disabled. See <code>STRIPE-SETUP.md</code>.
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = authed && currentTier === p.tier;
          return (
            <div
              key={p.tier}
              className={`card flex flex-col p-6 ${isCurrent ? "ring-2 ring-brand-500" : ""}`}
            >
              <div>
                <h2 className="text-xl font-semibold">{p.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{p.blurb}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-sm text-slate-500">{p.cadence}</span>
                </div>
              </div>

              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {p.tier === "free" ? (
                  isCurrent ? (
                    <button
                      disabled
                      className="btn-ghost w-full cursor-default opacity-60"
                    >
                      Current plan
                    </button>
                  ) : authed ? (
                    <Link href="/" className="btn-ghost w-full text-center">
                      Continue free
                    </Link>
                  ) : (
                    <Link
                      href="/signup?from=pricing"
                      className="btn-primary w-full text-center"
                    >
                      {p.cta}
                    </Link>
                  )
                ) : isCurrent ? (
                  <Link
                    href="/settings/billing"
                    className="btn-ghost w-full text-center"
                  >
                    Manage subscription
                  </Link>
                ) : (
                  <button
                    onClick={() => upgrade(p.tier as "pro" | "team")}
                    disabled={
                      isLoading ||
                      busy !== null ||
                      (authed && !stripeConfigured)
                    }
                    className="btn-primary w-full"
                  >
                    {busy === p.tier ? "Redirecting…" : p.cta}
                  </button>
                )}
                {!stripeConfigured && authed && p.tier !== "free" && (
                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    Billing not configured
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card p-5 text-sm text-slate-600">
        Pricing is in EUR and excludes VAT where applicable. You can cancel
        from the customer portal at any time and keep access through the end
        of your current period.
      </section>
    </div>
  );
}
