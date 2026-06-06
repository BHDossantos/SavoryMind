# Sellability Roadmap

This document tracks the path from MVP (Phase 4) → production SaaS → acquisition-ready product. Approved by the user: ICP = **search funders / micro-PE**; repo strategy = **(ii) keep monorepo, mark SavoryMind as legacy**, escalate to repo-split at Phase 13.

## North-star outcome

Sellable SaaS with:
- Real customers (paid Pro/Team tiers, demonstrable MRR)
- Defensible position (anonymized comp database)
- Clean books (Stripe + accounting export)
- Acceptable code/infra hygiene for diligence

## Phase plan

| Phase | Goal                                | Status   | Authorization wall          |
| ----- | ----------------------------------- | -------- | --------------------------- |
| 1–5   | MVP foundation through tested logic | ✅ Done   | —                           |
| 6     | Backend foundation (DB + auth + API)| Active   | None — local Postgres + dev creds |
| 7     | Frontend migration to API           | Pending  | None                        |
| 8     | Stripe billing                      | Pending  | **Needs Stripe account + keys** |
| 9     | Production deployment + observability | Pending | **Needs Vercel + Neon/Supabase + Sentry + PostHog accounts** |
| 10    | Marketing site + legal              | Pending  | Legal pages from template; user reviews before publish |
| 11    | Search-funder ICP features          | Pending  | None                        |
| 12    | Comp-database moat                  | Pending  | None                        |
| 13    | Sale prep + repo split              | Pending  | User executes actual repo creation |

## ICP decision (locked)

**Search funders / micro-PE.** Rationale: ~5K globally, well-funded, structured workflow needs, $200–500/mo per seat WTP. Closest fit to the deterministic + AI hybrid we've built.

Layered later: broker listing tools (Phase 11+ stretch) once search-funder workflow is solid.

## Repo strategy (locked)

**Strategy (ii) — keep monorepo, mark SavoryMind as legacy in the top-level README.** All DealFlow product code lives under `dealflow/`. Top-level README notes SavoryMind is unmaintained legacy and points at `dealflow/` as the active product.

At Phase 13, write a migration plan to extract `dealflow/` to its own repo. User executes the actual `gh repo create`.

## What I will autonomously do

- Ship every phase's code, tests, and GSD planning artifacts.
- Atomic commits, branch pushes.
- Write all template legal text, marketing copy, and runbook docs.
- Pause Phase 8 onwards at exactly the points marked **Authorization wall** above.

## What I will not do without explicit per-action approval

- Create third-party accounts in user's name (Stripe, Vercel, Neon/Supabase, Sentry, PostHog, OAuth providers, domain registrars).
- Spend any money (paid API tiers, hosting, domains).
- Publish anything to a public surface (Twitter, LinkedIn, Product Hunt, GitHub repo creation).
- Sign up for legal/payments/banking services.
- Contact prospects or partners.

When we reach an authorization wall, I stop, summarize what's needed, and wait.
