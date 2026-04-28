import { analyzeDeal } from "./scoring";
import { BUSINESS_TYPE_LABELS } from "./multiples";
import type { Deal } from "./types";

const HEADERS = [
  "name",
  "type",
  "location",
  "status",
  "priority",
  "revenue",
  "rent",
  "labor",
  "cogs",
  "utilities",
  "other_expenses",
  "owner_salary_addback",
  "asking_price",
  "net_profit",
  "ebitda",
  "margin_pct",
  "rent_ratio_pct",
  "labor_ratio_pct",
  "score",
  "score_profitability",
  "score_risk",
  "score_location",
  "score_growth",
  "score_price_fairness",
  "fair_value",
  "suggested_offer",
  "walk_away",
  "payback_years",
  "yearly_return_pct",
  "risk_flags",
  "created_at",
];

function escape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function dealsToCsv(deals: Deal[]): string {
  const rows: string[] = [HEADERS.join(",")];
  for (const d of deals) {
    const a = analyzeDeal(d);
    const row = [
      d.name,
      BUSINESS_TYPE_LABELS[d.businessType],
      d.location,
      d.status,
      d.priority,
      d.revenue,
      d.rent,
      d.laborCost,
      d.cogs,
      d.utilities,
      d.otherExpenses,
      d.ownerSalary ?? 0,
      d.askingPrice,
      Math.round(a.financials.netProfit),
      Math.round(a.financials.ebitda),
      (a.financials.margin * 100).toFixed(1),
      (a.financials.rentRatio * 100).toFixed(1),
      (a.financials.laborRatio * 100).toFixed(1),
      a.score.total,
      a.score.profitability,
      a.score.risk,
      a.score.location,
      a.score.growth,
      a.score.priceFairness,
      a.offer.fairValue,
      a.offer.suggestedOffer,
      a.offer.walkAwayPrice,
      Number.isFinite(a.roi.paybackYears)
        ? a.roi.paybackYears.toFixed(2)
        : "",
      (a.roi.yearlyReturnPct * 100).toFixed(1),
      a.risks.map((r) => `${r.severity}:${r.code}`).join("; "),
      d.createdAt,
    ];
    rows.push(row.map(escape).join(","));
  }
  return rows.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
