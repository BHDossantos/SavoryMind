"use client";

import Link from "next/link";
import { useState } from "react";
import type { Deal, PipelineStatus } from "@/lib/types";
import { analyzeDeal } from "@/lib/scoring";
import { eur } from "@/lib/format";
import { scoreColor, scoreLabel } from "@/components/ScoreBadge";
import { useDealsSource } from "@/lib/client/use-deals";
import { setStatusAction } from "@/lib/client/actions";

const COLUMNS: { key: PipelineStatus; label: string }[] = [
  { key: "lead", label: "Leads" },
  { key: "evaluating", label: "Evaluating" },
  { key: "negotiating", label: "Negotiating" },
  { key: "under_contract", label: "Under contract" },
  { key: "closed", label: "Closed" },
  { key: "passed", label: "Passed" },
];

export default function PipelinePage() {
  const { deals, isLoading, error, authed, refresh } = useDealsSource();
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped: Record<PipelineStatus, Deal[]> = {
    lead: [],
    evaluating: [],
    negotiating: [],
    under_contract: [],
    closed: [],
    passed: [],
  };
  deals.forEach((d) => grouped[d.status].push(d));

  async function move(deal: Deal, dir: -1 | 1) {
    const idx = COLUMNS.findIndex((c) => c.key === deal.status);
    const next = COLUMNS[idx + dir];
    if (!next) return;
    setBusyId(deal.id);
    try {
      await setStatusAction(authed, deal.id, next.key);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track deal progress from lead to close.
        </p>
      </div>

      {error && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Couldn&rsquo;t load deals: {error.message}
        </div>
      )}

      {isLoading && deals.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Loading…
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((col) => (
          <div key={col.key} className="rounded-xl bg-slate-100/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {col.label}
              </h3>
              <span className="text-xs text-slate-500">
                {grouped[col.key].length}
              </span>
            </div>
            <div className="space-y-2">
              {grouped[col.key].map((d) => {
                const a = analyzeDeal(d);
                const c = scoreColor(a.score.total);
                const isBusy = busyId === d.id;
                return (
                  <div key={d.id} className="card p-3">
                    <Link
                      href={`/deals/${d.id}`}
                      className="block text-sm font-medium hover:text-brand-700"
                    >
                      {d.name}
                    </Link>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{eur(d.askingPrice)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${c.bg} ${c.text}`}
                      >
                        {a.score.total} · {scoreLabel(a.score.total)}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button
                        className="btn-ghost flex-1 px-2 py-1 text-xs"
                        disabled={isBusy}
                        onClick={() => move(d, -1)}
                      >
                        ← back
                      </button>
                      <button
                        className="btn-ghost flex-1 px-2 py-1 text-xs"
                        disabled={isBusy}
                        onClick={() => move(d, 1)}
                      >
                        next →
                      </button>
                    </div>
                  </div>
                );
              })}
              {grouped[col.key].length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-xs text-slate-400">
                  empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
