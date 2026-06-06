import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  deleteDealForWorkspace,
  getByIdForWorkspace,
  updateDealForWorkspace,
} from "@/lib/db/deals-repo";
import { AuthError, jsonError, requireSession } from "@/lib/auth/server";
import { validateDealInput, validateStatusPatch } from "@/lib/api/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const ctx = await requireSession();
    const deal = await getByIdForWorkspace(db(), params.id, ctx.workspaceId);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return NextResponse.json({ deal });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteCtx) {
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

    const parsed = validateDealInput(body, "patch");
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Invalid deal payload", fields: parsed.errors },
        { status: 400 },
      );
    }
    const statusPatch = validateStatusPatch(body);
    if (!statusPatch.ok) {
      return NextResponse.json(
        { error: "Invalid status/priority", fields: statusPatch.errors },
        { status: 400 },
      );
    }

    const deal = await updateDealForWorkspace(
      db(),
      params.id,
      ctx.workspaceId,
      { ...parsed.value, ...statusPatch.value },
    );
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return NextResponse.json({ deal });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  try {
    const ctx = await requireSession();
    const ok = await deleteDealForWorkspace(
      db(),
      params.id,
      ctx.workspaceId,
    );
    if (!ok) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AuthError) return jsonError(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}
