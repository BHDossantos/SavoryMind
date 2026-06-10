"use client";

import Link from "next/link";
import { analyzeDeal } from "@/lib/scoring";
import DealCard from "@/components/DealCard";
import Stat from "@/components/Stat";
import ImportLocalBanner from "@/components/ImportLocalBanner";
import UpgradePrompt from "@/components/UpgradePrompt";
import { eur } from "@/lib/format";
import { dealsToCsv, downloadCsv } from "@/lib/csv";
import { useDealsSource } from "@/lib/client/use-deals";
import { useBillingSource } from "@/lib/client/use-billing";

export default function DashboardPage() {
  const { deals, isLoading, error, authed } = useDealsSource();
  const { data: billing } = useBillingSource();
  const atOrOverLimit =
    authed &&
    billing.limits.maxDeals !== null &&
    deals.length >= billing.limits.maxDeals;

  const analyses = deals.map((d) => ({ d, a: analyzeDeal(d) }));
  const avgScore =
    analyses.length === 0
      ? 0
      : Math.round(
          analyses.reduce((s, x) => s + x.a.score.total, 0) / analyses.length,
        );
  const totalAsking = deals.reduce((s, d) => s + (d.askingPrice || 0), 0);
  const annualEbitda = analyses.reduce((s, x) => s + x.a.financials.ebitda, 0);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Instant analysis for small business acquisitions. Add a deal to score
          profitability, risk, ROI, and a fair offer in seconds.
        </p>
        {!authed && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            You&rsquo;re using DealFlow without an account &mdash; deals live
            only in this browser.{" "}
            <Link href="/signup" className="underline">
              Create an account
            </Link>{" "}
            to save them to the cloud.
          </div>
        )}
      </section>

      <ImportLocalBanner />

      {atOrOverLimit && (
        <UpgradePrompt
          title={`You've hit the ${billing.limits.maxDeals}-deal limit on Free`}
          body="Upgrade to Pro for unlimited deals + Claude-generated analysis."
          source="dashboard_limit"
        />
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total deals" value={String(deals.length)} />
        <Stat
          label="Average score"
          value={avgScore ? String(avgScore) : "—"}
          tone={
            avgScore >= 75
              ? "good"
              : avgScore >= 55
                ? "warn"
                : avgScore
                  ? "bad"
                  : "default"
          }
        />
        <Stat label="Total asking" value={eur(totalAsking)} />
        <Stat
          label="Combined annual EBITDA"
          value={eur(annualEbitda)}
          hint="Across saved deals"
        />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Saved deals</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost"
              disabled={deals.length === 0}
              onClick={() => {
                const csv = dealsToCsv(deals);
                const date = new Date().toISOString().slice(0, 10);
                downloadCsv(`dealflow-deals-${date}.csv`, csv);
              }}
            >
              Export CSV
            </button>
            <Link href="/deals/new" className="btn-primary">
              + New Deal
            </Link>
          </div>
        </div>

        {error && (
          <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            Couldn&rsquo;t load deals: {error.message}
          </div>
        )}

        {!error && isLoading && deals.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-500">
            Loading…
          </div>
        )}

        {!error && !isLoading && deals.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-600">
            No deals yet. Click <span className="kbd">+ New Deal</span> to add
            one.
          </div>
        )}

        {deals.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
