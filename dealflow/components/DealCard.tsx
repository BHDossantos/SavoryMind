"use client";

import Link from "next/link";
import type { Deal } from "@/lib/types";
import { analyzeDeal } from "@/lib/scoring";
import { BUSINESS_TYPE_LABELS } from "@/lib/multiples";
import { eur, pct, years } from "@/lib/format";
import { scoreColor, scoreLabel } from "./ScoreBadge";

export default function DealCard({ deal }: { deal: Deal }) {
  const a = analyzeDeal(deal);
  const c = scoreColor(a.score.total);

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="card block p-4 transition hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold">{deal.name}</div>
          <div className="text-xs text-slate-500">
            {BUSINESS_TYPE_LABELS[deal.businessType]} · {deal.location}
          </div>
        </div>
        <div
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}
        >
          {a.score.total} · {scoreLabel(a.score.total)}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Asking</div>
          <div className="font-medium">{eur(deal.askingPrice)}</div>
        </div>
        <div>
          <div className="text-slate-500">Margin</div>
          <div className="font-medium">{pct(a.financials.margin)}</div>
        </div>
        <div>
          <div className="text-slate-500">Payback</div>
          <div className="font-medium">{years(a.roi.paybackYears)}</div>
        </div>
      </div>
    </Link>
  );
}
