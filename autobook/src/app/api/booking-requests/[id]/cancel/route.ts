import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { cancelRequest, getRequest } from "@/lib/bookings";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser();
    const id = Number((await ctx.params).id);
    const r = getRequest(id);
    if (!r) throw new HttpError(404, "Not found");
    if (r.user_id !== session.userId) throw new HttpError(403, "Forbidden");
    if (r.status === "completed" || r.status === "cancelled") {
      throw new HttpError(409, `Request already ${r.status}`);
    }
    cancelRequest(id, session.userId);
    return { ok: true };
  });
}
