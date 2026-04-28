import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/auth";
import { getRequest, upsertConfirmation } from "@/lib/bookings";

const Body = z.object({
  businessId: z.coerce.number().int().optional(),
  businessName: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  confirmationName: z.string().optional(),
  confirmationCode: z.string().optional(),
  venueContactPhone: z.string().optional(),
  address: z.string().optional(),
  instructions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  needsApproval: z.coerce.boolean().default(false),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  return handle(async () => {
    const session = await requireAdmin();
    const id = Number(ctx.params.id);
    if (!getRequest(id)) throw new HttpError(404, "Not found");
    const body = Body.parse(await req.json());
    upsertConfirmation({
      requestId: id,
      changedBy: session.userId,
      ...body,
    });
    return { ok: true };
  });
}
