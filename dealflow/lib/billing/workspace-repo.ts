import { eq, count as sqlCount } from "drizzle-orm";
import { deals, workspaces } from "@/lib/db/schema";
import type { DealflowDb } from "@/lib/db/client";
import type { BillingState, PlanStatus, PlanTier } from "./types";

function toBillingState(row: typeof workspaces.$inferSelect): BillingState {
  return {
    workspaceId: row.id,
    tier: row.planTier as PlanTier,
    status: row.planStatus as PlanStatus,
    seatCount: row.seatCount,
    currentPeriodEnd: row.currentPeriodEnd
      ? row.currentPeriodEnd.toISOString()
      : null,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
  };
}

export async function getBillingState(
  db: DealflowDb,
  workspaceId: string,
): Promise<BillingState | null> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (rows.length === 0) return null;
  return toBillingState(rows[0]);
}

export interface BillingPatch {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  planTier?: PlanTier;
  planStatus?: PlanStatus;
  seatCount?: number;
  currentPeriodEnd?: Date | null;
}

export async function setBillingState(
  db: DealflowDb,
  workspaceId: string,
  patch: BillingPatch,
): Promise<BillingState | null> {
  const updates: Record<string, unknown> = {};
  if (patch.stripeCustomerId !== undefined)
    updates.stripeCustomerId = patch.stripeCustomerId;
  if (patch.stripeSubscriptionId !== undefined)
    updates.stripeSubscriptionId = patch.stripeSubscriptionId;
  if (patch.planTier !== undefined) updates.planTier = patch.planTier;
  if (patch.planStatus !== undefined) updates.planStatus = patch.planStatus;
  if (patch.seatCount !== undefined) updates.seatCount = patch.seatCount;
  if (patch.currentPeriodEnd !== undefined)
    updates.currentPeriodEnd = patch.currentPeriodEnd;

  if (Object.keys(updates).length === 0) return getBillingState(db, workspaceId);

  const [row] = await db
    .update(workspaces)
    .set(updates)
    .where(eq(workspaces.id, workspaceId))
    .returning();
  return row ? toBillingState(row) : null;
}

export async function findWorkspaceByStripeCustomer(
  db: DealflowDb,
  stripeCustomerId: string,
): Promise<BillingState | null> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.stripeCustomerId, stripeCustomerId))
    .limit(1);
  if (rows.length === 0) return null;
  return toBillingState(rows[0]);
}

export async function countDealsForWorkspace(
  db: DealflowDb,
  workspaceId: string,
): Promise<number> {
  const rows = await db
    .select({ n: sqlCount() })
    .from(deals)
    .where(eq(deals.workspaceId, workspaceId));
  return Number(rows[0]?.n ?? 0);
}
