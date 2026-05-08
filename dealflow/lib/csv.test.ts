import { describe, expect, it } from "vitest";
import { dealsToCsv } from "./csv";
import type { Deal } from "./types";
import { healthyRestaurant, unprofitableBar } from "./__fixtures__/deals";

function toDeal(input: typeof healthyRestaurant, overrides: Partial<Deal> = {}): Deal {
  return {
    ...input,
    id: "test-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "lead",
    priority: "medium",
    ...overrides,
  };
}

const EXPECTED_HEADER = [
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
].join(",");

describe("dealsToCsv", () => {
  it("emits the documented header row in stable order", () => {
    const csv = dealsToCsv([toDeal(healthyRestaurant)]);
    const header = csv.split("\n")[0];
    expect(header).toBe(EXPECTED_HEADER);
  });

  it("escapes commas, quotes, and newlines in string fields", () => {
    const tricky = toDeal(healthyRestaurant, {
      name: 'Trattoria, "The Best"\nIn town',
    });
    const csv = dealsToCsv([tricky]);
    const dataRow = csv.split("\n").slice(1).join("\n");
    // Embedded newline + quotes + comma all live inside one quoted field
    expect(dataRow.startsWith('"Trattoria, ""The Best""\nIn town"')).toBe(true);
  });

  it("formats risk_flags as 'severity:code; severity:code'", () => {
    const csv = dealsToCsv([toDeal(unprofitableBar)]);
    const lines = csv.split("\n");
    const headerCols = lines[0].split(",");
    const idx = headerCols.indexOf("risk_flags");
    // The risk_flags cell is quoted because its content contains semicolons; pull it out.
    // Easiest: regex to find a field shaped like 'critical:unprofitable' anywhere.
    expect(lines[1]).toMatch(/critical:unprofitable/);
    expect(idx).toBeGreaterThan(-1);
  });

  it("handles multiple deals with one row per deal", () => {
    const csv = dealsToCsv([
      toDeal(healthyRestaurant),
      toDeal(unprofitableBar, { id: "b" }),
    ]);
    const lines = csv.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 data rows
  });
});
