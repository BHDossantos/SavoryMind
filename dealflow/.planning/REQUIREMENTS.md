# Requirements

Each requirement is traced to the phase that delivered it. v1 is everything
shipped on `claude/dealflow-ai-setup-WTRdF`.

## v1 — Shipped

| ID  | Requirement                                                                                | Phase |
| --- | ------------------------------------------------------------------------------------------ | ----- |
| R1  | Manual deal input: business meta + annual financials + 0–10 qualitative scores            | 1     |
| R2  | Rule-based scoring (profitability 30 / risk 25 / location 15 / growth 15 / price-fair 15) | 1     |
| R3  | Risk detection: rent ratio, labor ratio, margin, owner dependency, seasonality, unprofit. | 1     |
| R4  | ROI: payback period, yearly cash-on-cash, 3-year cash flow                                 | 1     |
| R5  | Industry-multiple fair value, suggested offer, walk-away price                             | 1     |
| R6  | Deal pipeline: Lead → Evaluating → Negotiating → Under contract → Closed / Passed         | 1     |
| R7  | Plain-English insight bullets per deal                                                     | 1     |
| R8  | LOI generator with editable terms, live preview, downloadable .txt                         | 1     |
| R9  | Dashboard with KPIs (deal count, avg score, total asking, combined EBITDA)                 | 1     |
| R10 | Local persistence (localStorage) with auto-seeded demo deals                               | 1     |
| R11 | Edit deal — re-runs analysis on save                                                       | 2     |
| R12 | Scenario simulator — what-if % sliders for asking, revenue, rent, labor                    | 2     |
| R13 | Side-by-side comparison view (up to 4 deals, best-value highlighting per metric)           | 3     |
| R14 | CSV export with full computed analysis (inputs + score + ROI + offer + risk codes)         | 3     |
| R15 | Per-deal document attachments (base64 in localStorage; ≤ 2 MB / file, ≤ 5 MB total)       | 3     |
| R16 | AI deal analysis: Claude Opus 4.7, adaptive thinking, json_schema output                   | 4     |
| R17 | AI narrative: thesis, verdict (pursue / negotiate_hard / pass), concerns, playbook, DDQ    | 4     |
| R18 | Graceful AI fallback when ANTHROPIC_API_KEY is unset (clear 503, app otherwise unaffected) | 4     |

## v2 — Planned (not started)

Listed in priority order from current best guess; will be re-ordered at the
next discuss-phase.

| ID  | Requirement                                                                              | Notes |
| --- | ---------------------------------------------------------------------------------------- | ----- |
| R19 | Real backend persistence (Postgres) + auth (NextAuth or Auth0)                           | Biggest single user-value lift; unblocks teams + sharing. |
| R20 | Batch AI analysis via Anthropic Batches API (50% cost on bulk runs)                      | Cheap to ship; great for portfolios. |
| R21 | Marketplace deal scraping (BizBuySell, BusinessesForSale, etc.)                          | Compliance + maintenance burden. |
| R22 | PDF LOI export with e-sign integration (DocuSign / Dropbox Sign)                         | High user value, integration-heavy. |
| R23 | Pipeline alerts (email / Slack) on status transitions                                    | Trivial once R19 lands. |
| R24 | Buyer-profile matching for brokers                                                       | Two-sided; needs R19 + new persona. |
| R25 | Multi-region: USD/GBP formatting, region-specific industry multiples                     | Localize multiples + EBITDA benchmarks. |
| R26 | Tested scoring engine (unit tests against golden dataset of historical deals)            | Pre-req for any rewrite. |

## Out of scope (explicit)

- Becoming a marketplace ourselves
- Performing brokerage / facilitating closings
- Regulated financial-advice product (RIA, etc.)
- Native mobile apps
- Real-time data sync across devices for the same user (covered indirectly by R19)
