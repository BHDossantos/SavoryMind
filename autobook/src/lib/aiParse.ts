import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const ParsedRequest = z.object({
  category: z
    .enum(["restaurant", "bar", "nightlife", "salon", "fitness", "custom"])
    .nullable()
    .describe("Best-fit category for the booking"),
  neighborhood: z
    .string()
    .nullable()
    .describe("Neighborhood, district, or area in the city (e.g. Trastevere, Prati)"),
  date: z
    .string()
    .nullable()
    .describe("ISO 8601 date YYYY-MM-DD; resolve relative dates (tonight, tomorrow) using TODAY"),
  time: z
    .string()
    .nullable()
    .describe("24-hour HH:MM time"),
  partySize: z.number().int().nullable().describe("Number of people"),
  budgetMax: z
    .number()
    .int()
    .nullable()
    .describe("Per-person budget ceiling in EUR; null if not specified"),
  vibe: z
    .string()
    .nullable()
    .describe("Short comma-separated tags capturing the vibe (e.g. 'romantic, not touristy')"),
  specialRequests: z
    .string()
    .nullable()
    .describe("Free-text special requests (occasion, dietary, accessibility, etc.)"),
});

export type ParsedRequest = z.infer<typeof ParsedRequest>;

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function aiParseAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function parseRequestText(rawText: string): Promise<ParsedRequest | null> {
  const c = getClient();
  if (!c) return null;

  const today = new Date().toISOString().slice(0, 10);

  const response = await c.messages.parse({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    output_config: {
      format: zodOutputFormat(ParsedRequest),
      effort: "low",
    },
    system: `You extract structured booking fields from a user's natural-language request to a personal booking assistant in Rome, Italy.

Rules:
- TODAY is ${today}. Resolve relative dates (tonight, tomorrow, this Friday, next weekend) against this.
- "tonight" → today's date, time around 20:00 unless specified.
- Default city is Rome; do not return city.
- Categories: restaurant (any food), bar (drinks/aperitivo), nightlife (clubs, late venues), salon (haircut, barber, beauty), fitness (gym, classes, BJJ, yoga), custom (anything else).
- Use null for any field the user did not specify or imply. Do not invent values.
- partySize: integer count of people.
- budgetMax: per-person ceiling in EUR. "around €100/pp" → 100. "cheap" → null (don't guess).
- vibe: a few comma-separated descriptive tags lifted from the request (e.g. "romantic, intimate", "lively, local").`,
    messages: [{ role: "user", content: rawText }],
  });

  return response.parsed_output ?? null;
}
