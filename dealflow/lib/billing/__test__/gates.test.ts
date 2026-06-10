/**
 * End-to-end gate test against a real (PGlite) database. Exercises:
 *  - countDealsForWorkspace returning the right count after inserts
 *  - canCreateDeal accepting #1–#3 and rejecting #4 on free
 *  - setBillingState upgrading to pro and canCreateDeal unlocking
 *  - canRunAIAnalysis flipping with the tier
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/lib/db/__test__/pglite-harness";
import { createUserWithDefaultWorkspace } from "@/lib/db/users-repo";
import { createDeal } from "@/lib/db/deals-repo";
import {
  countDealsForWorkspace,
  getBillingState,
  setBillingState,
} from "../workspace-repo";
import { canCreateDeal, canRunAIAnalysis } from "../plan";
import { healthyRestaurant } from "@/lib/__fixtures__/deals";

let h: TestDb;

beforeEach(async () => {
  h = await createTestDb();
});

afterEach(async () => {
  await h.close();
});

async function newUser(email: string) {
  return createUserWithDefaultWorkspace(h.db, {
    email,
    password: "correcthorse",
  });
}

describe("free tier gates", () => {
  it("blocks deal #4 and unblocks after upgrade to pro", async () => {
    const { userId, workspaceId } = await newUser("alice@example.com");
    for (let i = 0; i < 3; i++) {
      await createDeal(h.db, {
        workspaceId,
        createdById: userId,
        payload: { ...healthyRestaurant, name: `Deal ${i + 1}` },
      });
    }
    const stateBefore = await getBillingState(h.db, workspaceId);
    if (!stateBefore) throw new Error();
    const count = await countDealsForWorkspace(h.db, workspaceId);
    expect(count).toBe(3);

    const blocked = canCreateDeal(stateBefore, count);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("deal_limit");
      expect(blocked.currentTier).toBe("free");
    }

    await setBillingState(h.db, workspaceId, {
      planTier: "pro",
      planStatus: "active",
    });
    const stateAfter = await getBillingState(h.db, workspaceId);
    if (!stateAfter) throw new Error();
    expect(canCreateDeal(stateAfter, count).ok).toBe(true);
  });

  it("AI gate flips with the plan", async () => {
    const { workspaceId } = await newUser("bob@example.com");
    const free = await getBillingState(h.db, workspaceId);
    if (!free) throw new Error();
    expect(canRunAIAnalysis(free).ok).toBe(false);

    await setBillingState(h.db, workspaceId, { planTier: "pro" });
    const pro = await getBillingState(h.db, workspaceId);
    if (!pro) throw new Error();
    expect(canRunAIAnalysis(pro).ok).toBe(true);
  });
});
