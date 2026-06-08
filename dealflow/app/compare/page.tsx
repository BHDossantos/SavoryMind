"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { analyzeDeal } from "@/lib/scoring";
import { BUSINESS_TYPE_LABELS } from "@/lib/multiples";
import { eur, pct, years } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { scoreColor, scoreLabel } from "@/components/ScoreBadge";
import { useDealsSource } from "@/lib/client/use-deals";

const MAX_SELECT = 4;

export default function ComparePage() {
  const { deals, isLoading, error } = useDealsSource();
  const [selected, setSelected] = useState<string[]>([]);

  const chosen = useMemo(
    () =>
      selected
        .map((id) => deals.find((d) => d.id === id))
        .filter((d): d is Deal => Boolean(d)),
    [deals, selected],
  );

  function toggle(id: string) {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_SELECT) return s;
      return [...s, id];
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compare deals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Select up to {MAX_SELECT} deals for a side-by-side breakdown.
        </p>
      </div>

      {error && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Couldn&rsquo;t load deals: {error.message}
        </div>
      )}

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Select deals</h2>
        {isLoading && deals.length === 0 ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : deals.length === 0 ? (
          <div className="text-sm text-slate-500">
            No deals yet.{" "}
            <Link href="/deals/new" className="text-brand-600 underline">
              Add one
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((d) => {
              const isSel = selected.includes(d.id);
              const disabled = !isSel && selected.length >= MAX_SELECT;
              return (
                <label
                  key={d.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                    isSel
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 hover:bg-slate-50"
                  } ${disabled ? "opacity-50" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    disabled={disabled}
                    onChange={() => toggle(d.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="truncate text-xs text-slate-500">
                      {BUSINESS_TYPE_LABELS[d.businessType]} · {d.location}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </section>

      {chosen.length >= 2 && <ComparisonTable deals={chosen} />}
    </div>
  );
}

function ComparisonTable({ deals }: { deals: Deal[] }) {
  const analyses = deals.map((d) => ({ d, a: analyzeDeal(d) }));

  const rows: { label: string; render: (i: number) => React.ReactNode }[] = [
    {
      label: "Type",
      render: (i) => BUSINESS_TYPE_LABELS[deals[i].businessType],
    },
    { label: "Location", render: (i) => deals[i].location || "—" },
    {
      label: "Asking price",
      render: (i) => eur(deals[i].askingPrice),
    },
    {
      label: "Revenue",
      render: (i) => eur(analyses[i].a.financials.revenue),
    },
    {
      label: "Net profit",
      render: (i) => eur(analyses[i].a.financials.netProfit),
    },
    { label: "EBITDA", render: (i) => eur(analyses[i].a.financials.ebitda) },
    {
      label: "Margin",
      render: (i) => pct(analyses[i].a.financials.margin),
    },
    {
      label: "Rent ratio",
      render: (i) => pct(analyses[i].a.financials.rentRatio),
    },
    {
      label: "Labor ratio",
      render: (i) => pct(analyses[i].a.financials.laborRatio),
    },
    {
      label: "Fair value",
      render: (i) => eur(analyses[i].a.offer.fairValue),
    },
    {
      label: "Suggested offer",
      render: (i) => eur(analyses[i].a.offer.suggestedOffer),
    },
    {
      label: "Payback",
      render: (i) => years(analyses[i].a.roi.paybackYears),
    },
    {
      label: "Cash-on-cash",
      render: (i) => pct(analyses[i].a.roi.yearlyReturnPct),
    },
    {
      label: "Risk flags",
      render: (i) => analyses[i].a.risks.length || "0",
    },
  ];

  // Highlight the best deal in each numeric row.
  const bestIdxByLabel: Record<string, number | null> = {};
  const numericRows: Record<
    string,
    { values: number[]; higherIsBetter: boolean }
  > = {
    "Asking price": {
      values: deals.map((d) => d.askingPrice),
      higherIsBetter: false,
    },
    Revenue: {
      values: analyses.map((x) => x.a.financials.revenue),
      higherIsBetter: true,
    },
    "Net profit": {
      values: analyses.map((x) => x.a.financials.netProfit),
      higherIsBetter: true,
    },
    EBITDA: {
      values: analyses.map((x) => x.a.financials.ebitda),
      higherIsBetter: true,
    },
    Margin: {
      values: analyses.map((x) => x.a.financials.margin),
      higherIsBetter: true,
    },
    "Rent ratio": {
      values: analyses.map((x) => x.a.financials.rentRatio),
      higherIsBetter: false,
    },
    "Labor ratio": {
      values: analyses.map((x) => x.a.financials.laborRatio),
      higherIsBetter: false,
    },
    Payback: {
      values: analyses.map((x) => x.a.roi.paybackYears),
      higherIsBetter: false,
    },
    "Cash-on-cash": {
      values: analyses.map((x) => x.a.roi.yearlyReturnPct),
      higherIsBetter: true,
    },
    "Risk flags": {
      values: analyses.map((x) => x.a.risks.length),
      higherIsBetter: false,
    },
  };
  for (const [label, { values, higherIsBetter }] of Object.entries(
    numericRows,
  )) {
    const valid = values
      .map((v, i) => ({ v, i }))
      .filter((x) => Number.isFinite(x.v));
    if (valid.length === 0) {
      bestIdxByLabel[label] = null;
      continue;
    }
    const best = valid.reduce((a, b) =>
      higherIsBetter ? (a.v >= b.v ? a : b) : a.v <= b.v ? a : b,
    );
    bestIdxByLabel[label] = best.i;
  }

  return (
    <section className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Metric
              </th>
              {analyses.map(({ d, a }) => {
                const c = scoreColor(a.score.total);
                return (
                  <th key={d.id} className="px-4 py-3">
                    <Link
                      href={`/deals/${d.id}`}
                      className="block truncate font-semibold text-slate-900 hover:text-brand-700"
                    >
                      {d.name}
                    </Link>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}
                    >
                      {a.score.total} · {scoreLabel(a.score.total)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {row.label}
                </td>
                {analyses.map((_, i) => {
                  const isBest = bestIdxByLabel[row.label] === i;
                  return (
                    <td
                      key={i}
                      className={`px-4 py-2 ${
                        isBest ? "font-semibold text-emerald-700" : ""
                      }`}
                    >
                      {row.render(i)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
