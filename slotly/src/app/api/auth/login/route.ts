import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, createSession, findUserByEmail, verifyPassword } from "@/lib/auth";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = Body.parse(await req.json());
    const user = findUserByEmail(body.email);
    if (!user || !(await verifyPassword(user, body.password))) {
      throw new HttpError(401, "Invalid email or password");
    }
    await createSession({ userId: user.id, email: user.email, role: user.role });
    return { id: user.id, email: user.email, role: user.role };
  });
}
