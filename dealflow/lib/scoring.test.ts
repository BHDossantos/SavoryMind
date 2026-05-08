import { describe, expect, it } from "vitest";
import {
  analyze,
  calculateFinancials,
  calculateOffer,
  calculateROI,
  detectRisks,
} from "./scoring";
import {
  ALL_FIXTURES,
  extremeQualitativeHigh,
  extremeQualitativeLow,
  healthyRestaurant,
  highRentGym,
  ownerDependentSalon,
  seasonalCafe,
  unprofitableBar,
  zeroRevenue,
} from "./__fixtures__/deals";

describe("calculateFinancials", () => {
  it("computes net profit, EBITDA, and ratios for a healthy deal", () => {
    const f = calculateFinancials(healthyRestaurant);
    // 480k - (38+142+155+18+22)k = 105k
    expect(f.netProfit).toBe(105_000);
    // EBITDA adds back owner salary (45k)
    expect(f.ebitda).toBe(150_000);
    expect(f.margin).toBeCloseTo(105_000 / 480_000, 4);
    expect(f.rentRatio).toBeCloseTo(38_000 / 480_000, 4);
    expect(f.laborRatio).toBeCloseTo(142_000 / 480_000, 4);
    expect(f.cogsRatio).toBeCloseTo(155_000 / 480_000, 4);
  });

  it("returns zero ratios on zero-revenue deals without NaN", () => {
    const f = calculateFinancials(zeroRevenue);
    expect(f.revenue).toBe(0);
    expect(f.rentRatio).toBe(0);
    expect(f.laborRatio).toBe(0);
    expect(f.cogsRatio).toBe(0);
    expect(f.margin).toBe(0);
    expect(Number.isFinite(f.netProfit)).toBe(true);
    expect(Number.isFinite(f.ebitda)).toBe(true);
  });

  it("produces negative net profit for unprofitable inputs", () => {
    const f = calculateFinancials(unprofitableBar);
    expect(f.netProfit).toBeLessThan(0);
  });
});

describe("detectRisks", () => {
  it("flags rent_critical when rent exceeds 20% of revenue", () => {
    const f = calculateFinancials(highRentGym);
    const risks = detectRisks(highRentGym, f);
    const codes = risks.map((r) => r.code);
    expect(codes).toContain("rent_critical");
    expect(risks.find((r) => r.code === "rent_critical")?.severity).toBe(
      "critical",
    );
  });

  it("flags unprofitable when net profit is non-positive", () => {
    const f = calculateFinancials(unprofitableBar);
    const codes = detectRisks(unprofitableBar, f).map((r) => r.code);
    expect(codes).toContain("unprofitable");
  });

  it("flags owner_dependency on dependency >= 8", () => {
    const f = calculateFinancials(ownerDependentSalon);
    const codes = detectRisks(ownerDependentSalon, f).map((r) => r.code);
    expect(codes).toContain("owner_dependency");
  });

  it("flags seasonality on score >= 7", () => {
    const f = calculateFinancials(seasonalCafe);
    const codes = detectRisks(seasonalCafe, f).map((r) => r.code);
    expect(codes).toContain("seasonality");
  });

  it("returns no critical flags for a healthy deal", () => {
    const f = calculateFinancials(healthyRestaurant);
    const risks = detectRisks(healthyRestaurant, f);
    expect(risks.filter((r) => r.severity === "critical")).toHaveLength(0);
  });
});

describe("calculateOffer", () => {
  it("applies the industry multiple to EBITDA", () => {
    const f = calculateFinancials(healthyRestaurant);
    const offer = calculateOffer(healthyRestaurant, f);
    // Restaurant multiple is 2.2; EBITDA 150k -> ~330k pre risk-adj.
    expect(offer.industryMultiple).toBeCloseTo(2.2);
    expect(offer.fairValue).toBeGreaterThan(250_000);
    expect(offer.fairValue).toBeLessThan(360_000);
    // Suggested offer is below fair, walk-away is above.
    expect(offer.suggestedOffer).toBeLessThan(offer.fairValue);
    expect(offer.walkAwayPrice).toBeGreaterThan(offer.fairValue);
  });

  it("never produces a negative fair value", () => {
    const f = calculateFinancials(unprofitableBar);
    const offer = calculateOffer(unprofitableBar, f);
    expect(offer.fairValue).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateROI", () => {
  it("returns 99 (sentinel for infinite) on unprofitable deals", () => {
    const f = calculateFinancials(unprofitableBar);
    const roi = calculateROI(unprofitableBar, f);
    expect(roi.paybackYears).toBe(99);
    expect(roi.yearlyReturnPct).toBeLessThanOrEqual(0);
  });

  it("returns 99 when asking price is zero", () => {
    const f = calculateFinancials(healthyRestaurant);
    const roi = calculateROI(
      { ...healthyRestaurant, askingPrice: 0 },
      f,
    );
    expect(roi.paybackYears).toBe(99);
  });

  it("computes a sensible payback on a healthy deal", () => {
    const f = calculateFinancials(healthyRestaurant);
    const roi = calculateROI(healthyRestaurant, f);
    // 320k / 150k EBITDA = ~2.13 years
    expect(roi.paybackYears).toBeGreaterThan(1.5);
    expect(roi.paybackYears).toBeLessThan(3);
    expect(roi.yearlyReturnPct).toBeGreaterThan(0.3);
  });
});

describe("analyze (composition)", () => {
  it("returns a 0-100 total score on every fixture", () => {
    for (const [name, deal] of Object.entries(ALL_FIXTURES)) {
      const a = analyze(deal);
      expect(a.score.total, `${name} total in range`).toBeGreaterThanOrEqual(0);
      expect(a.score.total, `${name} total in range`).toBeLessThanOrEqual(100);
    }
  });

  it("maxes out location and growth when qualitatives are 10", () => {
    const a = analyze(extremeQualitativeHigh);
    expect(a.score.location).toBe(100);
    expect(a.score.growth).toBe(100);
  });

  it("zeros location and growth when qualitatives are 0", () => {
    const a = analyze(extremeQualitativeLow);
    expect(a.score.location).toBe(0);
    expect(a.score.growth).toBe(0);
  });

  it("produces deterministic, finite numbers across every sub-score", () => {
    for (const [name, deal] of Object.entries(ALL_FIXTURES)) {
      const a = analyze(deal);
      for (const key of [
        "profitability",
        "risk",
        "location",
        "growth",
        "priceFairness",
        "total",
      ] as const) {
        expect(
          Number.isFinite(a.score[key]),
          `${name} ${key} is finite`,
        ).toBe(true);
      }
    }
  });

  it("emits non-empty insights for every fixture", () => {
    for (const [name, deal] of Object.entries(ALL_FIXTURES)) {
      const a = analyze(deal);
      expect(a.insights.length, `${name} has insights`).toBeGreaterThan(0);
    }
  });
});
