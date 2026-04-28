import {
  INDUSTRY_MULTIPLES,
  RATIO_BENCHMARKS,
  BUSINESS_TYPE_LABELS,
} from "./multiples";
import type {
  Analysis,
  Deal,
  DealInput,
  Financials,
  Offer,
  RiskFlag,
  ROI,
  ScoreBreakdown,
} from "./types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const safe = (n: number | undefined) => (Number.isFinite(n) ? (n as number) : 0);

export function calculateFinancials(d: DealInput): Financials {
  const revenue = safe(d.revenue);
  const totalExpenses =
    safe(d.rent) +
    safe(d.laborCost) +
    safe(d.cogs) +
    safe(d.utilities) +
    safe(d.otherExpenses);

  const netProfit = revenue - totalExpenses;
  // EBITDA approximation: net profit + add-back of below-market or absent owner salary.
  const ebitda = netProfit + safe(d.ownerSalary);

  return {
    revenue,
    totalExpenses,
    netProfit,
    ebitda,
    margin: revenue > 0 ? netProfit / revenue : 0,
    rentRatio: revenue > 0 ? safe(d.rent) / revenue : 0,
    laborRatio: revenue > 0 ? safe(d.laborCost) / revenue : 0,
    cogsRatio: revenue > 0 ? safe(d.cogs) / revenue : 0,
  };
}

export function detectRisks(d: DealInput, f: Financials): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const bench = RATIO_BENCHMARKS[d.businessType];

  if (f.rentRatio > 0.2) {
    flags.push({
      code: "rent_critical",
      label: "Rent > 20% of revenue",
      severity: "critical",
      detail: `Rent is ${(f.rentRatio * 100).toFixed(1)}% of revenue. Industry healthy benchmark: ${(bench.rent * 100).toFixed(0)}%.`,
    });
  } else if (f.rentRatio > 0.15) {
    flags.push({
      code: "rent_high",
      label: "High rent ratio",
      severity: "high",
      detail: `Rent is ${(f.rentRatio * 100).toFixed(1)}% of revenue (target < 15%).`,
    });
  }

  if (f.laborRatio > 0.4) {
    flags.push({
      code: "labor_high",
      label: "Labor > 40% of revenue",
      severity: "high",
      detail: `Labor cost is ${(f.laborRatio * 100).toFixed(1)}% of revenue. Benchmark: ${(bench.labor * 100).toFixed(0)}%.`,
    });
  } else if (f.laborRatio > bench.labor + 0.05) {
    flags.push({
      code: "labor_above_bench",
      label: "Labor above industry benchmark",
      severity: "medium",
      detail: `Labor is ${(f.laborRatio * 100).toFixed(1)}% vs ${(bench.labor * 100).toFixed(0)}% benchmark.`,
    });
  }

  if (f.margin < 0.05) {
    flags.push({
      code: "margin_critical",
      label: "Net margin < 5%",
      severity: "critical",
      detail: `Net margin is ${(f.margin * 100).toFixed(1)}%. The business has almost no buffer.`,
    });
  } else if (f.margin < 0.1) {
    flags.push({
      code: "margin_low",
      label: "Low net margin",
      severity: "high",
      detail: `Net margin is ${(f.margin * 100).toFixed(1)}% (target > 10%).`,
    });
  }

  if (safe(d.ownerDependency) >= 8) {
    flags.push({
      code: "owner_dependency",
      label: "High owner dependency",
      severity: "high",
      detail:
        "Operations rely heavily on the current owner. Expect a transition risk and possible revenue loss post-handover.",
    });
  } else if (safe(d.ownerDependency) >= 6) {
    flags.push({
      code: "owner_dependency_med",
      label: "Moderate owner dependency",
      severity: "medium",
      detail:
        "The owner plays a significant operational role. Plan a structured transition.",
    });
  }

  if (safe(d.seasonality) >= 7) {
    flags.push({
      code: "seasonality",
      label: "Highly seasonal revenue",
      severity: "medium",
      detail:
        "Revenue concentrates in specific months. Working capital planning is critical.",
    });
  }

  if (f.netProfit <= 0) {
    flags.push({
      code: "unprofitable",
      label: "Currently unprofitable",
      severity: "critical",
      detail: "Reported expenses exceed revenue. Validate the numbers carefully.",
    });
  }

  return flags;
}

function scoreFromRatio(value: number, ideal: number, hardMax: number) {
  // 100 at or below ideal, 0 at hardMax, linear in between.
  if (value <= ideal) return 100;
  if (value >= hardMax) return 0;
  return clamp(100 * (1 - (value - ideal) / (hardMax - ideal)));
}

export function calculateScore(
  d: DealInput,
  f: Financials,
  risks: RiskFlag[],
  offer: Offer,
): ScoreBreakdown {
  // Profitability: blend of margin and absolute EBITDA against asking price.
  const marginScore = clamp(f.margin * 500); // 20% margin -> 100
  const cashYield =
    safe(d.askingPrice) > 0 ? f.ebitda / safe(d.askingPrice) : 0;
  const yieldScore = clamp(cashYield * 250); // 40% yield -> 100
  const profitability = Math.round((marginScore + yieldScore) / 2);

  // Risk: start at 100, deduct per flag severity.
  const deductions: Record<RiskFlag["severity"], number> = {
    low: 5,
    medium: 12,
    high: 22,
    critical: 35,
  };
  const riskScore = Math.round(
    clamp(100 - risks.reduce((s, r) => s + deductions[r.severity], 0)),
  );

  const location = Math.round(clamp(safe(d.locationQuality) * 10 || 50));
  const growth = Math.round(clamp(safe(d.growthPotential) * 10 || 50));

  // Price fairness: how close is asking price to fair value.
  const fair = offer.fairValue;
  const ask = safe(d.askingPrice);
  let priceFairness = 50;
  if (fair > 0 && ask > 0) {
    const ratio = ask / fair;
    // ratio = 1 → 80, ratio < 1 → up to 100 (underpriced), ratio > 1 → declines.
    if (ratio <= 1) priceFairness = clamp(80 + (1 - ratio) * 100);
    else priceFairness = clamp(80 - (ratio - 1) * 120);
  }
  priceFairness = Math.round(priceFairness);

  const total = Math.round(
    profitability * 0.3 +
      riskScore * 0.25 +
      location * 0.15 +
      growth * 0.15 +
      priceFairness * 0.15,
  );

  return {
    profitability,
    risk: riskScore,
    location,
    growth,
    priceFairness,
    total,
  };
}

export function calculateOffer(d: DealInput, f: Financials): Offer {
  const multiple = INDUSTRY_MULTIPLES[d.businessType];
  const baseEbitda = Math.max(f.ebitda, 0);
  let fairValue = baseEbitda * multiple;

  // Risk-adjust multiple based on simple qualitative inputs.
  const riskAdj =
    1 -
    (Math.max(0, safe(d.ownerDependency) - 5) * 0.02 +
      Math.max(0, safe(d.seasonality) - 5) * 0.015);
  fairValue = Math.max(0, fairValue * clamp(riskAdj, 0.6, 1.05));

  const suggestedOffer = Math.round(fairValue * 0.92); // start ~8% below fair
  const walkAwayPrice = Math.round(fairValue * 1.05); // never pay >5% over fair

  return {
    fairValue: Math.round(fairValue),
    suggestedOffer,
    walkAwayPrice,
    industryMultiple: multiple,
  };
}

export function calculateROI(d: DealInput, f: Financials): ROI {
  const ask = safe(d.askingPrice);
  const annual = Math.max(f.ebitda, 0);
  const paybackYears = annual > 0 && ask > 0 ? ask / annual : Infinity;
  const yearlyReturnPct = ask > 0 ? annual / ask : 0;
  return {
    paybackYears: Number.isFinite(paybackYears) ? paybackYears : 99,
    yearlyReturnPct,
    threeYearReturn: annual * 3,
  };
}

export function generateInsights(
  d: DealInput,
  f: Financials,
  s: ScoreBreakdown,
  o: Offer,
  roi: ROI,
): string[] {
  const out: string[] = [];
  const typeLabel = BUSINESS_TYPE_LABELS[d.businessType];

  if (s.total >= 75) {
    out.push(
      `Strong overall deal score (${s.total}/100). This ${typeLabel.toLowerCase()} shows healthy profitability and acceptable risk.`,
    );
  } else if (s.total >= 55) {
    out.push(
      `Decent deal (${s.total}/100), but several factors need attention before moving forward.`,
    );
  } else {
    out.push(
      `Weak deal (${s.total}/100). Major risks or mispricing — proceed only with significant price reduction.`,
    );
  }

  if (f.margin < 0.1) {
    out.push(
      `Net margin of ${(f.margin * 100).toFixed(1)}% is thin. Look for cost reductions in the largest line items before closing.`,
    );
  } else {
    out.push(
      `Net margin of ${(f.margin * 100).toFixed(1)}% is in a workable range.`,
    );
  }

  if (safe(d.askingPrice) > o.fairValue) {
    out.push(
      `Asking price is €${(safe(d.askingPrice) - o.fairValue).toLocaleString()} above estimated fair value. Use that as your negotiation lever.`,
    );
  } else if (safe(d.askingPrice) > 0) {
    out.push(
      `Asking price is at or below estimated fair value — likely a real opportunity if numbers verify.`,
    );
  }

  if (Number.isFinite(roi.paybackYears) && roi.paybackYears <= 4) {
    out.push(
      `Payback in ${roi.paybackYears.toFixed(1)} years (${(roi.yearlyReturnPct * 100).toFixed(1)}% cash-on-cash) is attractive for SMB acquisitions.`,
    );
  } else if (roi.paybackYears > 6) {
    out.push(
      `Payback exceeds ${roi.paybackYears.toFixed(1)} years. Negotiate price down to bring it under 5 years.`,
    );
  }

  return out;
}

export function analyze(d: DealInput): Analysis {
  const financials = calculateFinancials(d);
  const offer = calculateOffer(d, financials);
  const risks = detectRisks(d, financials);
  const score = calculateScore(d, financials, risks, offer);
  const roi = calculateROI(d, financials);
  const insights = generateInsights(d, financials, score, offer, roi);
  return { financials, offer, risks, score, roi, insights };
}

export function analyzeDeal(d: Deal): Analysis {
  return analyze(d);
}
