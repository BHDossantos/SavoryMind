import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { users, workspaces, workspaceMembers } from "./schema";
import type { DealflowDb } from "./client";

const BCRYPT_COST = 12;

export interface NewUserInput {
  email: string;
  name?: string;
  password: string;
}

export interface SignupResult {
  userId: string;
  workspaceId: string;
}

/**
 * Create a user, hash their password, and create their default workspace
 * with them as the owner — all in a single transaction.
 */
export async function createUserWithDefaultWorkspace(
  db: DealflowDb,
  input: NewUserInput,
): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_COST);

  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        name: input.name?.trim() || null,
        hashedPassword,
      })
      .returning({ id: users.id });

    const workspaceName = input.name?.trim()
      ? `${input.name.trim()}'s workspace`
      : "My workspace";

    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: workspaceName,
        ownerId: user.id,
      })
      .returning({ id: workspaces.id });

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    return { userId: user.id, workspaceId: workspace.id };
  });
}

export async function findUserByEmail(db: DealflowDb, email: string) {
  const lowered = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, lowered))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Returns the user if the password is correct, null otherwise.
 * Always runs bcrypt.compare even when the user doesn't exist, to avoid
 * a timing side channel that leaks email validity.
 */
export async function verifyCredentials(
  db: DealflowDb,
  email: string,
  password: string,
) {
  const user = await findUserByEmail(db, email);
  const hash =
    user?.hashedPassword ??
    "$2a$12$invalidplaceholderhashwithcorrectlengthxxxxxxxxxxxxxxxx";
  const ok = await bcrypt.compare(password, hash);
  if (!ok || !user || !user.hashedPassword) return null;
  return user;
}

/**
 * Resolves the default workspace ID for a user (the workspace they own
 * with the earliest createdAt). Returns null if the user has no workspace
 * yet — this should not happen in practice because signup creates one.
 */
export async function findDefaultWorkspaceId(
  db: DealflowDb,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .orderBy(workspaces.createdAt)
    .limit(1);
  return rows[0]?.id ?? null;
}
