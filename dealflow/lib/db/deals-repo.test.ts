import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./__test__/pglite-harness";
import {
  createDeal,
  deleteDealForWorkspace,
  getByIdForWorkspace,
  listForWorkspace,
  updateDealForWorkspace,
} from "./deals-repo";
import { createUserWithDefaultWorkspace } from "./users-repo";
import { healthyRestaurant } from "@/lib/__fixtures__/deals";

let h: TestDb;

beforeEach(async () => {
  h = await createTestDb();
});

afterEach(async () => {
  await h.close();
});

async function makeUser(email: string) {
  return await createUserWithDefaultWorkspace(h.db, {
    email,
    name: email.split("@")[0],
    password: "correct-horse-battery-staple",
  });
}

describe("deals-repo", () => {
  it("create + get + list round-trip in a workspace", async () => {
    const { userId, workspaceId } = await makeUser("alice@example.com");
    const created = await createDeal(h.db, {
      workspaceId,
      createdById: userId,
      payload: { ...healthyRestaurant },
    });
    expect(created.id).toBeTruthy();
    expect(created.workspaceId).toBe(workspaceId);

    const fetched = await getByIdForWorkspace(h.db, created.id, workspaceId);
    expect(fetched?.name).toBe(healthyRestaurant.name);

    const list = await listForWorkspace(h.db, workspaceId);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  it("enforces workspace scope — deal from workspace A is invisible to workspace B", async () => {
    const a = await makeUser("alice@example.com");
    const b = await makeUser("bob@example.com");

    const created = await createDeal(h.db, {
      workspaceId: a.workspaceId,
      createdById: a.userId,
      payload: { ...healthyRestaurant },
    });

    // From Bob's workspace, the deal must look like it doesn't exist.
    const crossTenant = await getByIdForWorkspace(
      h.db,
      created.id,
      b.workspaceId,
    );
    expect(crossTenant).toBeNull();

    const listB = await listForWorkspace(h.db, b.workspaceId);
    expect(listB).toHaveLength(0);
  });

  it("update + delete are also workspace-scoped", async () => {
    const a = await makeUser("alice@example.com");
    const b = await makeUser("bob@example.com");

    const created = await createDeal(h.db, {
      workspaceId: a.workspaceId,
      createdById: a.userId,
      payload: { ...healthyRestaurant },
    });

    // Bob cannot update Alice's deal
    const blockedUpdate = await updateDealForWorkspace(
      h.db,
      created.id,
      b.workspaceId,
      { name: "hijacked" },
    );
    expect(blockedUpdate).toBeNull();

    // Alice can
    const allowedUpdate = await updateDealForWorkspace(
      h.db,
      created.id,
      a.workspaceId,
      { name: "renamed" },
    );
    expect(allowedUpdate?.name).toBe("renamed");

    // Bob cannot delete
    const blockedDelete = await deleteDealForWorkspace(
      h.db,
      created.id,
      b.workspaceId,
    );
    expect(blockedDelete).toBe(false);

    // Alice can
    const allowedDelete = await deleteDealForWorkspace(
      h.db,
      created.id,
      a.workspaceId,
    );
    expect(allowedDelete).toBe(true);

    // Now gone
    const fetched = await getByIdForWorkspace(h.db, created.id, a.workspaceId);
    expect(fetched).toBeNull();
  });

  it("partial updates leave untouched fields alone", async () => {
    const { userId, workspaceId } = await makeUser("alice@example.com");
    const created = await createDeal(h.db, {
      workspaceId,
      createdById: userId,
      payload: { ...healthyRestaurant },
    });

    const updated = await updateDealForWorkspace(
      h.db,
      created.id,
      workspaceId,
      { status: "negotiating" },
    );

    expect(updated?.status).toBe("negotiating");
    expect(updated?.name).toBe(healthyRestaurant.name);
    expect(updated?.revenue).toBe(healthyRestaurant.revenue);
  });
});
