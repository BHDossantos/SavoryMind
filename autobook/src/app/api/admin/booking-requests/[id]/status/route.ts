import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { getRequest, setStatus } from "@/lib/bookings";

const Body = z.object({
  status: z.enum([
    "submitted",
    "in_review",
    "searching",
    "contacting",
    "needs_approval",
    "confirmed",
    "failed",
    "cancelled",
    "completed",
  ]),
  notes: z.string().optional(),
});

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const id = Number(ctx.params.id);
    if (!getRequest(id)) throw new HttpError(404, "Not found");
    const body = Body.parse(await req.json());
    setStatus(id, body.status, session.userId, body.notes ?? null);
    return { ok: true };
  });
}
