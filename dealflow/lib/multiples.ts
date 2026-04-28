import type { BusinessType } from "./types";

// EBITDA multiples used for fair-value calculation. Conservative SMB ranges.
export const INDUSTRY_MULTIPLES: Record<BusinessType, number> = {
  restaurant: 2.2,
  bar: 2.5,
  cafe: 2.4,
  gym: 2.8,
  salon: 2.0,
  retail: 2.3,
  laundromat: 3.2,
  auto_shop: 2.6,
  other: 2.5,
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurant: "Restaurant",
  bar: "Bar",
  cafe: "Café",
  gym: "Gym",
  salon: "Salon",
  retail: "Retail Store",
  laundromat: "Laundromat",
  auto_shop: "Auto Shop",
  other: "Other",
};

// Healthy ratio benchmarks (rent / labor / cogs as % of revenue) per industry.
export const RATIO_BENCHMARKS: Record<
  BusinessType,
  { rent: number; labor: number; cogs: number }
> = {
  restaurant: { rent: 0.08, labor: 0.3, cogs: 0.32 },
  bar: { rent: 0.08, labor: 0.25, cogs: 0.25 },
  cafe: { rent: 0.1, labor: 0.3, cogs: 0.3 },
  gym: { rent: 0.15, labor: 0.35, cogs: 0.05 },
  salon: { rent: 0.12, labor: 0.4, cogs: 0.1 },
  retail: { rent: 0.08, labor: 0.18, cogs: 0.55 },
  laundromat: { rent: 0.15, labor: 0.1, cogs: 0.05 },
  auto_shop: { rent: 0.1, labor: 0.3, cogs: 0.3 },
  other: { rent: 0.1, labor: 0.3, cogs: 0.3 },
};
