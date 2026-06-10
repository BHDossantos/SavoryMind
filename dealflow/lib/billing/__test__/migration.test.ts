import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { workspaces } from "@/lib/db/schema";
import {
  createTestDb,
  type TestDb,
} from "@/lib/db/__test__/pglite-harness";
import { createUserWithDefaultWorkspace } from "@/lib/db/users-repo";
import {
  countDealsForWorkspace,
  getBillingState,
  setBillingState,
} from "../workspace-repo";

let h: TestDb;

beforeEach(async () => {
  h = await createTestDb();
});

afterEach(async () => {
  await h.close();
});

describe("billing migration (0001_billing.sql)", () => {
  it("a freshly signed-up workspace defaults to free / active / 1 seat", async () => {
    const { workspaceId } = await createUserWithDefaultWorkspace(h.db, {
      email: "alice@example.com",
      password: "correcthorse",
    });
    const state = await getBillingState(h.db, workspaceId);
    expect(state).not.toBeNull();
    if (!state) throw new Error();
    expect(state.tier).toBe("free");
    expect(state.status).toBe("active");
    expect(state.seatCount).toBe(1);
    expect(state.stripeCustomerId).toBeNull();
    expect(state.currentPeriodEnd).toBeNull();
  });

  it("setBillingState writes only the fields present in the patch", async () => {
    const { workspaceId } = await createUserWithDefaultWorkspace(h.db, {
      email: "bob@example.com",
      password: "correcthorse",
    });
    const periodEnd = new Date("2026-12-31T00:00:00.000Z");
    const updated = await setBillingState(h.db, workspaceId, {
      stripeCustomerId: "cus_abc",
      planTier: "pro",
      planStatus: "active",
      currentPeriodEnd: periodEnd,
    });
    expect(updated?.tier).toBe("pro");
    expect(updated?.stripeCustomerId).toBe("cus_abc");
    expect(updated?.currentPeriodEnd).toBe(periodEnd.toISOString());
    // unrelated field untouched
    expect(updated?.seatCount).toBe(1);
  });

  it("the stripe_customer_id index lets us find a workspace by Stripe id", async () => {
    const { workspaceId } = await createUserWithDefaultWorkspace(h.db, {
      email: "carol@example.com",
      password: "correcthorse",
    });
    await setBillingState(h.db, workspaceId, {
      stripeCustomerId: "cus_lookup",
    });
    const rows = await h.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.stripeCustomerId, "cus_lookup"));
    expect(rows[0]?.id).toBe(workspaceId);
  });

  it("countDealsForWorkspace returns zero for a new workspace", async () => {
    const { workspaceId } = await createUserWithDefaultWorkspace(h.db, {
      email: "dan@example.com",
      password: "correcthorse",
    });
    expect(await countDealsForWorkspace(h.db, workspaceId)).toBe(0);
  });
});
