"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dealsRepo } from "@/lib/storage";
import { analyzeDeal } from "@/lib/scoring";
import type { Deal } from "@/lib/types";
import DealCard from "@/components/DealCard";
import Stat from "@/components/Stat";
import { eur } from "@/lib/format";
import { dealsToCsv, downloadCsv } from "@/lib/csv";

export default function DashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    dealsRepo.seedDemoIfEmpty();
    const refresh = () => setDeals(dealsRepo.list());
    refresh();
    window.addEventListener("dealflow:change", refresh);
    return () => window.removeEventListener("dealflow:change", refresh);
  }, []);

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
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total deals" value={String(deals.length)} />
        <Stat
          label="Average score"
          value={avgScore ? String(avgScore) : "—"}
          tone={avgScore >= 75 ? "good" : avgScore >= 55 ? "warn" : avgScore ? "bad" : "default"}
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
        {deals.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-600">
            No deals yet. Click <span className="kbd">+ New Deal</span> to add
            one.
          </div>
        ) : (
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
