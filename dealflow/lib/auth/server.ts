import { NextResponse } from "next/server";
import { auth } from "@/auth";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface RequiredSession {
  userId: string;
  workspaceId: string;
  email: string | null;
}

/**
 * Resolve the current session and return the user/workspace IDs.
 * Throws AuthError(401) if there is no session, AuthError(403) if the
 * user has no workspace yet (signup integrity issue — should not happen).
 *
 * Use inside route handlers:
 *
 *   try {
 *     const ctx = await requireSession();
 *     // ...
 *   } catch (e) {
 *     if (e instanceof AuthError) return jsonError(e);
 *     throw e;
 *   }
 */
export async function requireSession(): Promise<RequiredSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Not authenticated", 401);
  }
  if (!session.user.workspaceId) {
    throw new AuthError("Workspace not provisioned", 403);
  }
  return {
    userId: session.user.id,
    workspaceId: session.user.workspaceId,
    email: session.user.email ?? null,
  };
}

export function jsonError(err: AuthError) {
  return NextResponse.json({ error: err.message }, { status: err.status });
}
