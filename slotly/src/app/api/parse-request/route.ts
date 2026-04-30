import { z } from "zod";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { aiParseAvailable, parseRequestText } from "@/lib/aiParse";

const Body = z.object({
  text: z.string().min(3).max(2000),
});

export async function POST(req: Request) {
  return handle(async () => {
    await requireUser();
    if (!aiParseAvailable()) {
      throw new HttpError(503, "AI parsing not configured (ANTHROPIC_API_KEY unset)");
    }
    const { text } = Body.parse(await req.json());
    const parsed = await parseRequestText(text);
    if (!parsed) throw new HttpError(502, "Parser returned no result");
    return parsed;
  });
}
