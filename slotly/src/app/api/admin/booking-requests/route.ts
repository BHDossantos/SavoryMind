import { handle } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { adminListQueue } from "@/lib/bookings";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const url = new URL(req.url);
    return adminListQueue({
      status: url.searchParams.get("status") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
    });
  });
}
