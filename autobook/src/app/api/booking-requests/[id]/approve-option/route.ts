import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { approveOption, getRequest } from "@/lib/bookings";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  return handle(async () => {
    const session = await requireUser();
    const id = Number(ctx.params.id);
    const r = getRequest(id);
    if (!r) throw new HttpError(404, "Not found");
    if (r.user_id !== session.userId) throw new HttpError(403, "Forbidden");
    if (r.status !== "needs_approval") {
      throw new HttpError(409, "No alternative pending approval");
    }
    approveOption(id, session.userId);
    return { ok: true };
  });
}
