import { describe, expect, it } from "vitest";
import { defaultLoiInput, generateLoi, type LoiInput } from "./loi";
import { analyze } from "./scoring";
import type { Deal } from "./types";
import { healthyRestaurant } from "./__fixtures__/deals";

function buildDeal(): Deal {
  return {
    ...healthyRestaurant,
    id: "test-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "lead",
    priority: "medium",
  };
}

describe("defaultLoiInput", () => {
  it("returns a closing date roughly 60 days out", () => {
    const input = defaultLoiInput();
    const closing = new Date(input.closingDate);
    const days = (closing.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(58);
    expect(days).toBeLessThan(62);
  });

  it("defaults to 30-day diligence and financing contingency on", () => {
    const input = defaultLoiInput();
    expect(input.dueDiligenceDays).toBe(30);
    expect(input.financingContingency).toBe(true);
    expect(input.earnestMoney).toBe(5000);
  });
});

describe("generateLoi", () => {
  const baseInput: LoiInput = {
    buyerName: "Jane Doe",
    buyerEntity: "Acme Holdings, Lda.",
    closingDate: "2026-06-01",
    earnestMoney: 5000,
    dueDiligenceDays: 30,
    financingContingency: true,
  };

  it("includes the deal name, suggested offer in EUR, and exclusivity clause", () => {
    const deal = buildDeal();
    const a = analyze(deal);
    const text = generateLoi(deal, a, baseInput);
    expect(text).toContain(deal.name);
    expect(text).toContain("LETTER OF INTENT");
    expect(text).toContain("EXCLUSIVITY");
    expect(text).toContain("NON-BINDING");
    // Suggested offer should appear formatted with euro sign
    expect(text).toMatch(/€[\d,]+/);
  });

  it("includes the financing-contingency section only when enabled", () => {
    const deal = buildDeal();
    const a = analyze(deal);
    const withFinance = generateLoi(deal, a, baseInput);
    const withoutFinance = generateLoi(deal, a, {
      ...baseInput,
      financingContingency: false,
    });
    expect(withFinance).toContain("FINANCING CONTINGENCY");
    expect(withoutFinance).not.toContain("FINANCING CONTINGENCY");
  });

  it("falls back to a placeholder line when buyer name is empty", () => {
    const deal = buildDeal();
    const a = analyze(deal);
    const text = generateLoi(deal, a, { ...baseInput, buyerName: "" });
    expect(text).toMatch(/Buyer:\s+_+/);
  });

  it("includes the buyer entity line only when provided", () => {
    const deal = buildDeal();
    const a = analyze(deal);
    const withEntity = generateLoi(deal, a, baseInput);
    const withoutEntity = generateLoi(deal, a, { ...baseInput, buyerEntity: "" });
    expect(withEntity).toContain("Acme Holdings, Lda.");
    expect(withoutEntity).not.toContain("Entity:");
  });
});
