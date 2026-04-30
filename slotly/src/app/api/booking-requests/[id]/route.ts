import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import {
  getConfirmedBooking,
  getContactAttempts,
  getRequest,
  getStatusHistory,
} from "@/lib/bookings";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireUser();
    const id = Number((await ctx.params).id);
    const req = getRequest(id);
    if (!req) throw new HttpError(404, "Not found");
    if (req.user_id !== session.userId && session.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }
    return {
      request: req,
      confirmation: getConfirmedBooking(id) ?? null,
      history: getStatusHistory(id),
      contactAttempts: session.role === "admin" ? getContactAttempts(id) : [],
    };
  });
}
