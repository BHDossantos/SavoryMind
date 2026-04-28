# DealFlow AI

A web app for finding, analyzing, scoring, negotiating and tracking small
business acquisitions (restaurants, bars, gyms, salons, retail, …).

## What it does

Enter the financials of a target business and instantly get:

- True net profit and EBITDA (with owner-salary add-back)
- A 0–100 deal score (profitability 30%, risk 25%, location 15%, growth 15%,
  price fairness 15%)
- Risk flags (rent ratio, labor ratio, margin, owner dependency, seasonality,
  unprofitability)
- ROI: payback period, yearly return, 3-year cash flow
- Fair value, suggested first offer, walk-away price (industry-multiple based)
- Plain-English insights
- A pipeline (Lead → Evaluating → Negotiating → Under contract → Closed / Passed)
- A one-click LOI generator (downloadable text)
- A scenario simulator (what-if % sliders for asking price, revenue, rent, labor)
- A comparison view (up to 4 deals side-by-side, best-value highlighting)
- Document attachments per deal (PDF, images, etc., stored locally)
- CSV export of all deals with key metrics

## Tech

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- localStorage persistence (no backend required for the MVP)

## Run locally

```bash
cd dealflow
npm install
npm run dev
```

Then open http://localhost:3000.

The app seeds two demo deals on first load. Add your own from `+ New Deal`.

## Project layout

```
dealflow/
├─ app/                    # Next.js App Router pages
│  ├─ page.tsx             # Dashboard
│  ├─ deals/new/page.tsx   # Add a deal
│  ├─ deals/[id]/page.tsx  # Deal detail + analysis
│  ├─ pipeline/page.tsx    # Kanban pipeline
│  └─ loi/[id]/page.tsx    # LOI generator
├─ components/             # Reusable UI
└─ lib/
   ├─ types.ts             # Domain types
   ├─ scoring.ts           # Financials, risk, score, ROI, offer engine
   ├─ multiples.ts         # Industry multiples + ratio benchmarks
   ├─ loi.ts               # LOI template
   ├─ storage.ts           # localStorage repo
   └─ format.ts            # EUR / %% / years formatters
```

## Roadmap (Phase 2)

- AI-driven natural language analysis
- Deal scraping from marketplaces
- Multi-user collaboration
- Database-backed persistence (Postgres) and auth
- Document storage (S3) and PDF LOIs
- Buyer profile matching for brokers
