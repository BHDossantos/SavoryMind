import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, createSession, createUser, findUserByEmail } from "@/lib/auth";
import { notify } from "@/lib/notifications";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = Body.parse(await req.json());
    if (findUserByEmail(body.email)) {
      throw new HttpError(409, "Email already registered");
    }
    const user = await createUser(body);
    await createSession({ userId: user.id, email: user.email, role: user.role });
    void notify({ userId: user.id, kind: "welcome" });
    return { id: user.id, email: user.email, role: user.role };
  });
}
