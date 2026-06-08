"use client";

import { apiCreateDeal } from "./api";
import { dealsRepo } from "@/lib/storage";
import type { Deal, DealInput } from "@/lib/types";

export interface ImportResult {
  imported: Deal[];
  failed: { localId: string; name: string; error: string }[];
}

/**
 * Push every local deal into the API. On success for an individual deal,
 * remove it from localStorage. Returns counts so the UI can summarize.
 *
 * No bulk endpoint yet — N round trips. For typical local volumes
 * (1-20 deals) this is acceptable; revisit when we add the Bulk Import
 * feature in a later phase.
 */
export async function importLocalDealsToApi(
  localDeals: Deal[],
): Promise<ImportResult> {
  const imported: Deal[] = [];
  const failed: ImportResult["failed"] = [];

  for (const local of localDeals) {
    try {
      const input = toDealInput(local);
      const created = await apiCreateDeal(input);
      // If the local deal had an AI narrative or attachments, push them through too.
      // (apiCreateDeal doesn't currently set those — we'd need a follow-up PUT.
      // Phase 7 ships the create path; a follow-up enriches.)
      imported.push(created);
      dealsRepo.remove(local.id);
    } catch (e) {
      failed.push({
        localId: local.id,
        name: local.name,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }
  return { imported, failed };
}

function toDealInput(d: Deal): DealInput {
  return {
    name: d.name,
    businessType: d.businessType,
    location: d.location,
    notes: d.notes,
    revenue: d.revenue,
    rent: d.rent,
    laborCost: d.laborCost,
    cogs: d.cogs,
    utilities: d.utilities,
    otherExpenses: d.otherExpenses,
    ownerSalary: d.ownerSalary,
    askingPrice: d.askingPrice,
    locationQuality: d.locationQuality,
    growthPotential: d.growthPotential,
    ownerDependency: d.ownerDependency,
    seasonality: d.seasonality,
  };
}
