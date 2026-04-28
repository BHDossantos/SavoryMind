import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { analyze } from "@/lib/scoring";
import { BUSINESS_TYPE_LABELS } from "@/lib/multiples";
import type { AINarrative, Deal } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a senior small-business acquisition advisor with 20+ years of experience in main-street M&A — restaurants, gyms, salons, retail, services. You evaluate deals like a buyer who has both walked away from bad ones and closed great ones.

Your job: given the financials and a rule-based analysis of a target business, produce a sharp, opinionated narrative for the buyer.

Frameworks you apply:

1. EBITDA quality — is the reported number defensible after normalizing rent, owner salary add-backs, working-capital needs?
2. Multiple sanity check — small SMBs trade at 2.0-3.5x EBITDA; deviations need explanation.
3. Risk concentration — owner dependency, lease term, single-customer risk, seasonality, equipment age.
4. Operating leverage — where can a new owner drive 10-20% improvement in 12 months without heroics?
5. Walk-away discipline — name a number above which the deal stops working.

Style:
- Be concrete. "Rent at 18% — 3 points above benchmark — push for a CAM-cap or rent abatement" beats "rent is high".
- Numbers, not adjectives.
- One opinion per sentence. No hedging filler.
- Buyer-side voice, never neutral.

Verdict rules:
- "pursue": deal score >= 70, no critical risks, payback <= 5 years.
- "negotiate_hard": meaningful flaws but salvageable with the right price/terms.
- "pass": critical unprofitability, lease/owner risk, or asking >> fair value with no leverage to close the gap.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    thesis: {
      type: "string",
      description:
        "2-3 sentence investment thesis. State the strongest reason to pursue and the strongest reason for caution. Do not hedge.",
    },
    verdict: {
      type: "string",
      enum: ["pursue", "negotiate_hard", "pass"],
      description: "Recommended next action.",
    },
    key_concerns: {
      type: "array",
      items: { type: "string" },
      description:
        "3-5 concerns ranked by severity. Each must be specific, with a number where possible.",
    },
    negotiation_playbook: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: {
            type: "string",
            description: "Specific concession or term to negotiate for.",
          },
          leverage: {
            type: "string",
            description:
              "Why this is a credible ask — cite a number, ratio, or risk from the data.",
          },
        },
        required: ["point", "leverage"],
        additionalProperties: false,
      },
      description: "3-5 concrete negotiation points with rationale.",
    },
    due_diligence_checklist: {
      type: "array",
      items: { type: "string" },
      description:
        "6-10 specific items the buyer must verify before closing — each actionable, not generic.",
    },
  },
  required: [
    "thesis",
    "verdict",
    "key_concerns",
    "negotiation_playbook",
    "due_diligence_checklist",
  ],
  additionalProperties: false,
};

function buildUserMessage(deal: Deal) {
  const a = analyze(deal);
  const f = a.financials;
  const fmt = (n: number) => `€${Math.round(n).toLocaleString()}`;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  return `DEAL: ${deal.name}
Business type: ${BUSINESS_TYPE_LABELS[deal.businessType]}
Location: ${deal.location || "(not provided)"}
Asking price: ${fmt(deal.askingPrice)}
Notes: ${deal.notes || "(none)"}

ANNUAL FINANCIALS
  Revenue:           ${fmt(f.revenue)}
  Rent:              ${fmt(deal.rent)}  (${pct(f.rentRatio)} of revenue)
  Labor:             ${fmt(deal.laborCost)} (${pct(f.laborRatio)} of revenue)
  COGS:              ${fmt(deal.cogs)} (${pct(f.cogsRatio)} of revenue)
  Utilities:         ${fmt(deal.utilities)}
  Other expenses:    ${fmt(deal.otherExpenses)}
  Owner salary add-back: ${fmt(deal.ownerSalary || 0)}
  Net profit:        ${fmt(f.netProfit)} (margin ${pct(f.margin)})
  EBITDA:            ${fmt(f.ebitda)}

QUALITATIVE (0-10)
  Location quality:   ${deal.locationQuality ?? "—"}
  Growth potential:   ${deal.growthPotential ?? "—"}
  Owner dependency:   ${deal.ownerDependency ?? "—"}
  Seasonality:        ${deal.seasonality ?? "—"}

RULE-BASED ANALYSIS
  Deal score:         ${a.score.total}/100  (profitability ${a.score.profitability}, risk ${a.score.risk}, location ${a.score.location}, growth ${a.score.growth}, price fairness ${a.score.priceFairness})
  Industry multiple:  ${a.offer.industryMultiple.toFixed(2)}x EBITDA
  Estimated fair val: ${fmt(a.offer.fairValue)}
  Suggested offer:    ${fmt(a.offer.suggestedOffer)}
  Walk-away price:    ${fmt(a.offer.walkAwayPrice)}
  Payback:            ${Number.isFinite(a.roi.paybackYears) ? a.roi.paybackYears.toFixed(1) + " years" : "n/a"}
  Cash-on-cash:       ${pct(a.roi.yearlyReturnPct)}
  Risk flags:         ${a.risks.length === 0 ? "none" : a.risks.map((r) => `[${r.severity}] ${r.label}`).join("; ")}

Produce the structured analysis now.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "AI analysis is not configured. Set ANTHROPIC_API_KEY in your environment.",
      },
      { status: 503 },
    );
  }

  let deal: Deal;
  try {
    deal = (await req.json()) as Deal;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!deal?.name || !deal?.businessType) {
    return NextResponse.json({ error: "Invalid deal payload" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserMessage(deal) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Model returned no text output" },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(textBlock.text) as Omit<
      AINarrative,
      "generatedAt"
    >;
    const narrative: AINarrative = {
      ...parsed,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(narrative, {
      headers: {
        "x-claude-cache-read": String(response.usage.cache_read_input_tokens ?? 0),
        "x-claude-cache-write": String(response.usage.cache_creation_input_tokens ?? 0),
      },
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Invalid ANTHROPIC_API_KEY" },
        { status: 401 },
      );
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by Claude API. Try again in a moment." },
        { status: 429 },
      );
    }
    if (e instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error (${e.status}): ${e.message}` },
        { status: 502 },
      );
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
