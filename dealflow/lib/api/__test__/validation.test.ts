import { describe, expect, it } from "vitest";
import { validateDealInput, validateStatusPatch } from "../validation";
import { healthyRestaurant } from "@/lib/__fixtures__/deals";

describe("validateDealInput (create)", () => {
  it("accepts a complete valid payload", () => {
    const result = validateDealInput(healthyRestaurant, "create");
    expect(result.ok).toBe(true);
  });

  it("rejects when required fields are missing", () => {
    const result = validateDealInput({}, "create");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBeTruthy();
      expect(result.errors.businessType).toBeTruthy();
    }
  });

  it("rejects an unknown businessType", () => {
    const result = validateDealInput(
      { ...healthyRestaurant, businessType: "spaceship" },
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.businessType).toBeTruthy();
  });

  it("rejects negative revenue", () => {
    const result = validateDealInput(
      { ...healthyRestaurant, revenue: -1 },
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.revenue).toBeTruthy();
  });

  it("rejects qualitative values outside 0–10", () => {
    const result = validateDealInput(
      { ...healthyRestaurant, locationQuality: 15 },
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.locationQuality).toBeTruthy();
  });

  it("coerces stringified numbers", () => {
    const result = validateDealInput(
      { ...healthyRestaurant, revenue: "480000" },
      "create",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.revenue).toBe(480_000);
  });
});

describe("validateDealInput (patch)", () => {
  it("accepts an empty object — no required fields in patch mode", () => {
    const result = validateDealInput({}, "patch");
    expect(result.ok).toBe(true);
  });

  it("still rejects bad values in patch mode", () => {
    const result = validateDealInput({ revenue: -5 }, "patch");
    expect(result.ok).toBe(false);
  });
});

describe("validateStatusPatch", () => {
  it("accepts valid status and priority", () => {
    const result = validateStatusPatch({
      status: "negotiating",
      priority: "high",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown status values", () => {
    const result = validateStatusPatch({ status: "ghosted" });
    expect(result.ok).toBe(false);
  });

  it("ignores unrelated fields", () => {
    const result = validateStatusPatch({
      status: "lead",
      somethingElse: "x",
    });
    expect(result.ok).toBe(true);
  });
});
