import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  createUserWithDefaultWorkspace,
  findUserByEmail,
} from "@/lib/db/users-repo";
import { validateSignup } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validateSignup(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid signup payload", fields: parsed.errors },
      { status: 400 },
    );
  }

  const existing = await findUserByEmail(db(), parsed.value.email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  try {
    const result = await createUserWithDefaultWorkspace(db(), parsed.value);
    return NextResponse.json(
      { userId: result.userId, workspaceId: result.workspaceId },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
