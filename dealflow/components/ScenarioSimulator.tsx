"use client";

import { useMemo, useState } from "react";
import { analyze } from "@/lib/scoring";
import type { Deal } from "@/lib/types";
import { eur, pct, years } from "@/lib/format";
import { scoreColor } from "./ScoreBadge";

interface Adjustments {
  askingPriceDelta: number; // %
  rentDelta: number; // %
  laborDelta: number; // %
  revenueDelta: number; // %
}

const ZERO: Adjustments = {
  askingPriceDelta: 0,
  rentDelta: 0,
  laborDelta: 0,
  revenueDelta: 0,
};

export default function ScenarioSimulator({ deal }: { deal: Deal }) {
  const [adj, setAdj] = useState<Adjustments>(ZERO);

  const baseline = useMemo(() => analyze(deal), [deal]);

  const simulated = useMemo(() => {
    const apply = (v: number, delta: number) => v * (1 + delta / 100);
    return analyze({
      ...deal,
      askingPrice: apply(deal.askingPrice, adj.askingPriceDelta),
      rent: apply(deal.rent, adj.rentDelta),
      laborCost: apply(deal.laborCost, adj.laborDelta),
      revenue: apply(deal.revenue, adj.revenueDelta),
    });
  }, [deal, adj]);

  const baseColor = scoreColor(baseline.score.total);
  const simColor = scoreColor(simulated.score.total);
  const scoreDelta = simulated.score.total - baseline.score.total;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Scenario simulator</h2>
          <p className="mt-1 text-xs text-slate-500">
            What-if levers. Nothing is saved — drag sliders to see the impact.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => setAdj(ZERO)}
        >
          Reset
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Slider
          label="Asking price"
          value={adj.askingPriceDelta}
          onChange={(v) => setAdj((a) => ({ ...a, askingPriceDelta: v }))}
          min={-40}
          max={20}
        />
        <Slider
          label="Revenue"
          value={adj.revenueDelta}
          onChange={(v) => setAdj((a) => ({ ...a, revenueDelta: v }))}
          min={-30}
          max={30}
        />
        <Slider
          label="Rent"
          value={adj.rentDelta}
          onChange={(v) => setAdj((a) => ({ ...a, rentDelta: v }))}
          min={-30}
          max={30}
        />
        <Slider
          label="Labor"
          value={adj.laborDelta}
          onChange={(v) => setAdj((a) => ({ ...a, laborDelta: v }))}
          min={-30}
          max={30}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Compare
          label="Score"
          before={`${baseline.score.total}`}
          after={`${simulated.score.total}`}
          delta={scoreDelta}
          afterClass={`${simColor.text}`}
          beforeClass={`${baseColor.text}`}
        />
        <Compare
          label="Net profit"
          before={eur(baseline.financials.netProfit)}
          after={eur(simulated.financials.netProfit)}
          delta={simulated.financials.netProfit - baseline.financials.netProfit}
          formatDelta={eur}
        />
        <Compare
          label="Payback"
          before={years(baseline.roi.paybackYears)}
          after={years(simulated.roi.paybackYears)}
          delta={baseline.roi.paybackYears - simulated.roi.paybackYears}
          formatDelta={(n) => `${n.toFixed(1)} yrs faster`}
          deltaIsImprovement
        />
        <Compare
          label="Cash-on-cash"
          before={pct(baseline.roi.yearlyReturnPct)}
          after={pct(simulated.roi.yearlyReturnPct)}
          delta={
            simulated.roi.yearlyReturnPct - baseline.roi.yearlyReturnPct
          }
          formatDelta={(n) => pct(n)}
        />
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        <span className="text-xs font-mono text-slate-700">
          {value > 0 ? "+" : ""}
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{min}%</span>
        <span>0</span>
        <span>+{max}%</span>
      </div>
    </div>
  );
}

function Compare({
  label,
  before,
  after,
  delta,
  formatDelta,
  beforeClass,
  afterClass,
  deltaIsImprovement,
}: {
  label: string;
  before: string;
  after: string;
  delta: number;
  formatDelta?: (n: number) => string;
  beforeClass?: string;
  afterClass?: string;
  deltaIsImprovement?: boolean;
}) {
  const positive = deltaIsImprovement ? delta > 0 : delta > 0;
  const negative = deltaIsImprovement ? delta < 0 : delta < 0;
  const deltaColor = positive
    ? "text-emerald-700"
    : negative
      ? "text-rose-700"
      : "text-slate-500";
  const sign = delta > 0 ? "+" : "";
  const formatted = formatDelta
    ? `${sign}${formatDelta(Math.abs(delta) === delta ? delta : delta)}`
    : `${sign}${delta.toFixed(1)}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-sm line-through ${beforeClass ?? "text-slate-400"}`}>
          {before}
        </span>
        <span className={`text-lg font-semibold ${afterClass ?? "text-slate-900"}`}>
          {after}
        </span>
      </div>
      {Math.abs(delta) > 0.0001 && (
        <div className={`mt-1 text-xs font-medium ${deltaColor}`}>{formatted}</div>
      )}
    </div>
  );
}
