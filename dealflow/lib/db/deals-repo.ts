import { and, desc, eq } from "drizzle-orm";
import { deals, type DbDeal } from "./schema";
import type { DealflowDb } from "./client";
import type { DealInput, AINarrative, Attachment } from "@/lib/types";

export type DealPayload = DealInput & {
  attachments?: Attachment[];
  aiNarrative?: AINarrative;
  status?: DbDeal["status"];
  priority?: DbDeal["priority"];
};

function inputToInsert(
  workspaceId: string,
  createdById: string,
  input: DealPayload,
) {
  return {
    workspaceId,
    createdById,
    name: input.name,
    businessType: input.businessType,
    location: input.location ?? "",
    notes: input.notes ?? null,
    revenue: input.revenue ?? 0,
    rent: input.rent ?? 0,
    laborCost: input.laborCost ?? 0,
    cogs: input.cogs ?? 0,
    utilities: input.utilities ?? 0,
    otherExpenses: input.otherExpenses ?? 0,
    ownerSalary: input.ownerSalary ?? 0,
    askingPrice: input.askingPrice ?? 0,
    locationQuality: input.locationQuality ?? null,
    growthPotential: input.growthPotential ?? null,
    ownerDependency: input.ownerDependency ?? null,
    seasonality: input.seasonality ?? null,
    status: input.status ?? "lead",
    priority: input.priority ?? "medium",
    attachments: input.attachments ?? null,
    aiNarrative: input.aiNarrative ?? null,
  };
}

export async function listForWorkspace(
  db: DealflowDb,
  workspaceId: string,
): Promise<DbDeal[]> {
  return await db
    .select()
    .from(deals)
    .where(eq(deals.workspaceId, workspaceId))
    .orderBy(desc(deals.createdAt));
}

export async function getByIdForWorkspace(
  db: DealflowDb,
  id: string,
  workspaceId: string,
): Promise<DbDeal | null> {
  const rows = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createDeal(
  db: DealflowDb,
  args: {
    workspaceId: string;
    createdById: string;
    payload: DealPayload;
  },
): Promise<DbDeal> {
  const [row] = await db
    .insert(deals)
    .values(inputToInsert(args.workspaceId, args.createdById, args.payload))
    .returning();
  return row;
}

export async function updateDealForWorkspace(
  db: DealflowDb,
  id: string,
  workspaceId: string,
  payload: Partial<DealPayload>,
): Promise<DbDeal | null> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  // Only assign defined fields; explicit undefineds are skipped so partial PUT works.
  const map: Record<keyof DealPayload, string> = {
    name: "name",
    businessType: "businessType",
    location: "location",
    notes: "notes",
    revenue: "revenue",
    rent: "rent",
    laborCost: "laborCost",
    cogs: "cogs",
    utilities: "utilities",
    otherExpenses: "otherExpenses",
    ownerSalary: "ownerSalary",
    askingPrice: "askingPrice",
    locationQuality: "locationQuality",
    growthPotential: "growthPotential",
    ownerDependency: "ownerDependency",
    seasonality: "seasonality",
    status: "status",
    priority: "priority",
    attachments: "attachments",
    aiNarrative: "aiNarrative",
  };
  for (const [key, col] of Object.entries(map) as [
    keyof DealPayload,
    string,
  ][]) {
    if (payload[key] !== undefined) updates[col] = payload[key];
  }

  const [row] = await db
    .update(deals)
    .set(updates)
    .where(and(eq(deals.id, id), eq(deals.workspaceId, workspaceId)))
    .returning();
  return row ?? null;
}

export async function deleteDealForWorkspace(
  db: DealflowDb,
  id: string,
  workspaceId: string,
): Promise<boolean> {
  const result = await db
    .delete(deals)
    .where(and(eq(deals.id, id), eq(deals.workspaceId, workspaceId)))
    .returning({ id: deals.id });
  return result.length > 0;
}
