"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { dealsRepo } from "@/lib/storage";
import { analyzeDeal } from "@/lib/scoring";
import type { Deal, PipelineStatus, Priority } from "@/lib/types";
import { BUSINESS_TYPE_LABELS } from "@/lib/multiples";
import { eur, pct, years } from "@/lib/format";
import ScoreBadge from "@/components/ScoreBadge";
import RiskFlags from "@/components/RiskFlags";
import Stat from "@/components/Stat";

const STATUSES: PipelineStatus[] = [
  "lead",
  "evaluating",
  "negotiating",
  "under_contract",
  "closed",
  "passed",
];

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const [deal, setDeal] = useState<Deal | undefined>();

  useEffect(() => {
    const refresh = () => setDeal(dealsRepo.get(id));
    refresh();
    window.addEventListener("dealflow:change", refresh);
    return () => window.removeEventListener("dealflow:change", refresh);
  }, [id]);

  const analysis = useMemo(() => (deal ? analyzeDeal(deal) : null), [deal]);

  if (!deal || !analysis) {
    return (
      <div className="card p-8 text-center text-sm text-slate-600">
        Deal not found.{" "}
        <Link href="/" className="text-brand-600 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { financials: f, score, risks, roi, offer, insights } = analysis;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">
            {BUSINESS_TYPE_LABELS[deal.businessType]} · {deal.location}
          </div>
          <h1 className="text-2xl font-semibold">{deal.name}</h1>
          <div className="mt-1 text-sm text-slate-600">
            Asking price: <span className="font-medium">{eur(deal.askingPrice)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ScoreBadge score={score.total} size="lg" />
          <Link href={`/loi/${deal.id}`} className="btn-primary">
            Generate LOI
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Net profit" value={eur(f.netProfit)} tone={f.netProfit > 0 ? "good" : "bad"} />
        <Stat label="EBITDA" value={eur(f.ebitda)} hint={`Margin ${pct(f.margin)}`} />
        <Stat
          label="Payback period"
          value={years(roi.paybackYears)}
          hint={`${pct(roi.yearlyReturnPct)} cash-on-cash`}
          tone={roi.paybackYears <= 4 ? "good" : roi.paybackYears <= 6 ? "warn" : "bad"}
        />
        <Stat label="Suggested offer" value={eur(offer.suggestedOffer)} hint={`Walk-away ${eur(offer.walkAwayPrice)}`} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Score breakdown</h2>
          <div className="mt-4 space-y-3">
            <ScoreBar label="Profitability" weight={30} value={score.profitability} />
            <ScoreBar label="Risk" weight={25} value={score.risk} />
            <ScoreBar label="Location" weight={15} value={score.location} />
            <ScoreBar label="Growth" weight={15} value={score.growth} />
            <ScoreBar label="Price fairness" weight={15} value={score.priceFairness} />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Risk flags</h2>
          <div className="mt-3">
            <RiskFlags risks={risks} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Financial breakdown</h2>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            <Row k="Revenue" v={eur(f.revenue)} />
            <Row k="Rent" v={`${eur(deal.rent)} (${pct(f.rentRatio)})`} />
            <Row k="Labor" v={`${eur(deal.laborCost)} (${pct(f.laborRatio)})`} />
            <Row k="COGS" v={`${eur(deal.cogs)} (${pct(f.cogsRatio)})`} />
            <Row k="Utilities" v={eur(deal.utilities)} />
            <Row k="Other" v={eur(deal.otherExpenses)} />
            <Row k="Total expenses" v={eur(f.totalExpenses)} />
            <Row k="Net profit" v={eur(f.netProfit)} bold />
            <Row k="EBITDA" v={eur(f.ebitda)} bold />
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Negotiation strategy</h2>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            <Row k="Industry multiple" v={`${offer.industryMultiple.toFixed(2)}× EBITDA`} />
            <Row k="Estimated fair value" v={eur(offer.fairValue)} />
            <Row k="Suggested first offer" v={eur(offer.suggestedOffer)} bold />
            <Row k="Walk-away price" v={eur(offer.walkAwayPrice)} />
            <Row k="Asking vs fair" v={
              deal.askingPrice <= offer.fairValue
                ? `${eur(offer.fairValue - deal.askingPrice)} below`
                : `${eur(deal.askingPrice - offer.fairValue)} above`
            } />
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Open at the suggested offer. Justify with rent ratio, labor ratio,
            and risk flags. Never exceed the walk-away price.
          </p>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Plain-English insights</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {insights.map((i, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="text-brand-600">•</span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Pipeline</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Status</label>
            <select
              className="select"
              value={deal.status}
              onChange={(e) =>
                dealsRepo.setStatus(deal.id, e.target.value as PipelineStatus)
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select
              className="select"
              value={deal.priority}
              onChange={(e) =>
                dealsRepo.setPriority(deal.id, e.target.value as Priority)
              }
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              className="btn-ghost text-rose-700 hover:bg-rose-50"
              onClick={() => {
                if (confirm("Delete this deal?")) {
                  dealsRepo.remove(deal.id);
                  router.push("/");
                }
              }}
            >
              Delete deal
            </button>
          </div>
        </div>
        {deal.notes && (
          <div className="mt-4">
            <label className="label">Notes</label>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap">
              {deal.notes}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-slate-600">{k}</dt>
      <dd className={bold ? "font-semibold" : ""}>{v}</dd>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: number;
}) {
  const color =
    value >= 75 ? "bg-emerald-500" : value >= 55 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-slate-500">
          {value}/100 · weight {weight}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
