import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { getRequest, logContactAttempt, setStatus } from "@/lib/bookings";

const Body = z.object({
  businessId: z.coerce.number().int().optional(),
  method: z.enum(["phone", "whatsapp", "email", "in_person", "other"]),
  result: z.enum(["no_answer", "rejected", "pending", "confirmed", "alternative_offered"]),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAdmin();
    const id = Number((await ctx.params).id);
    const r = getRequest(id);
    if (!r) throw new HttpError(404, "Not found");
    const body = Body.parse(await req.json());
    logContactAttempt({
      requestId: id,
      businessId: body.businessId,
      method: body.method,
      result: body.result,
      notes: body.notes,
      contactedBy: session.userId,
    });
    if (r.status === "submitted" || r.status === "in_review" || r.status === "searching") {
      setStatus(id, "contacting", session.userId, "Began contacting venues");
    }
    return { ok: true };
  });
}
