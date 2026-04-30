import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createRequest, listMyRequests } from "@/lib/bookings";

const Body = z.object({
  category: z.enum(["restaurant", "bar", "nightlife", "salon", "fitness", "custom"]),
  rawText: z.string().max(2000).optional(),
  city: z.string().default("Rome"),
  neighborhood: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  partySize: z.coerce.number().int().min(1).max(50).default(2),
  budgetMin: z.coerce.number().int().nonnegative().optional(),
  budgetMax: z.coerce.number().int().nonnegative().optional(),
  vibe: z.string().optional(),
  specialRequests: z.string().max(1000).optional(),
  contactName: z.string().min(1),
  contactPhone: z.string().min(3),
  priority: z.enum(["normal", "priority", "vip"]).default("normal"),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireUser();
    const body = Body.parse(await req.json());
    const created = createRequest({ userId: session.userId, ...body });
    return created;
  });
}

export async function GET() {
  return handle(async () => {
    const session = await requireUser();
    return listMyRequests(session.userId);
  });
}
