import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { createDeal, listForWorkspace } from "@/lib/db/deals-repo";
import { AuthError, jsonError, requireSession } from "@/lib/auth/server";
import { validateDealInput, validateStatusPatch } from "@/lib/api/validation";
import type { DealInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireSession();
    const deals = await listForWorkspace(db(), ctx.workspaceId);
    return NextResponse.json({ deals });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSession();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const parsed = validateDealInput(body, "create");
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Invalid deal payload", fields: parsed.errors },
        { status: 400 },
      );
    }
    // Status/priority are optional on create — validate them separately if present.
    const statusPatch = validateStatusPatch(body);
    if (!statusPatch.ok) {
      return NextResponse.json(
        { error: "Invalid status/priority", fields: statusPatch.errors },
        { status: 400 },
      );
    }

    const deal = await createDeal(db(), {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      payload: {
        ...(parsed.value as DealInput),
        ...statusPatch.value,
      },
    });
    return NextResponse.json({ deal }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
