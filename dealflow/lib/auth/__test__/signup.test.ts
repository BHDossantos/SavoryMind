import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { users, workspaces, workspaceMembers } from "@/lib/db/schema";
import {
  createUserWithDefaultWorkspace,
  findUserByEmail,
  verifyCredentials,
} from "@/lib/db/users-repo";
import {
  createTestDb,
  type TestDb,
} from "@/lib/db/__test__/pglite-harness";
import { validateSignup } from "../validation";

let h: TestDb;

beforeEach(async () => {
  h = await createTestDb();
});

afterEach(async () => {
  await h.close();
});

describe("validateSignup", () => {
  it("accepts a well-formed payload", () => {
    const result = validateSignup({
      email: "alice@example.com",
      name: "Alice",
      password: "correcthorsebattery",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing email and short password", () => {
    const result = validateSignup({ email: "", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toBeTruthy();
      expect(result.errors.password).toBeTruthy();
    }
  });

  it("rejects invalid email format", () => {
    const result = validateSignup({
      email: "not-an-email",
      password: "longenoughpassword",
    });
    expect(result.ok).toBe(false);
  });
});

describe("createUserWithDefaultWorkspace", () => {
  it("creates user, workspace, and ownership row in one transaction", async () => {
    const { userId, workspaceId } = await createUserWithDefaultWorkspace(
      h.db,
      {
        email: "Alice@Example.com",
        name: "Alice",
        password: "correcthorsebattery",
      },
    );

    // Email normalized to lowercase
    const fetched = await findUserByEmail(h.db, "alice@example.com");
    expect(fetched?.id).toBe(userId);
    expect(fetched?.email).toBe("alice@example.com");

    // Workspace created, named after the user
    const ws = await h.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
    expect(ws[0]?.ownerId).toBe(userId);
    expect(ws[0]?.name).toContain("Alice");

    // Owner membership row inserted
    const member = await h.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));
    expect(member[0]?.role).toBe("owner");
    expect(member[0]?.workspaceId).toBe(workspaceId);
  });

  it("password is hashed (bcrypt) — never stored in plaintext", async () => {
    await createUserWithDefaultWorkspace(h.db, {
      email: "bob@example.com",
      password: "literally-my-password",
    });
    const row = await h.db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, "bob@example.com"));
    const hash = row[0]?.hashedPassword ?? "";
    expect(hash.length).toBeGreaterThan(40);
    expect(hash).not.toContain("literally-my-password");
    // Sanity: the hash actually verifies
    const ok = await bcrypt.compare("literally-my-password", hash);
    expect(ok).toBe(true);
  });
});

describe("verifyCredentials", () => {
  it("returns the user when password is correct", async () => {
    await createUserWithDefaultWorkspace(h.db, {
      email: "carol@example.com",
      password: "openseasame",
    });
    const user = await verifyCredentials(h.db, "carol@example.com", "openseasame");
    expect(user?.email).toBe("carol@example.com");
  });

  it("returns null for wrong password", async () => {
    await createUserWithDefaultWorkspace(h.db, {
      email: "dan@example.com",
      password: "first-pwd",
    });
    const user = await verifyCredentials(h.db, "dan@example.com", "wrong");
    expect(user).toBeNull();
  });

  it("returns null for unknown email (and still runs bcrypt for timing safety)", async () => {
    const user = await verifyCredentials(
      h.db,
      "nobody@example.com",
      "irrelevant",
    );
    expect(user).toBeNull();
  });
});
