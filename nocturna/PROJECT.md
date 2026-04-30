# Nocturna · Project

> *"Where should we go tonight, and how do we make the night amazing?"*

Nocturna is a nightlife concierge: a planner that produces curated multi-stop
itineraries (dinner → bar → club → late food) for ten cities based on vibe,
budget, group, music, and location, then handles bookings, VIP tables,
sharing, feedback, and reminders.

## Why it exists

The original product brief identified 15 distinct pain points around going
out — tourists overwhelmed by Google/TikTok, locals unsure where the right
crowd is tonight, couples who pick mismatched venues, groups who can't
agree, no clear way to request VIP tables, slow midweek venue traffic,
poor signal on whether a place needs a reservation. Nocturna replaces an
hour of cross-app research with three curated plans and a one-tap booking
flow.

## Who it serves

| Persona | Primary use |
|---|---|
| Tourists / business travellers | "I'm in Rome tonight — plan it for me" |
| Locals + expats | Hidden gems, fresh ideas, escape the same 5 places |
| Couples on a date | Romantic dinner + sexy bar curated together |
| Groups of friends | Group voting on a single plan |
| Single people | Singles-friendly bars + clubs |
| Venue partners | Demand on slow nights, VIP table fulfilment |
| Admin / concierge team | Manual booking flow, partner invoicing |

## Core promise (one line)

**Your perfect night, planned in seconds, booked in one tap.**

## Where it lives

Inside the `SavoryMind` monorepo at `/nocturna/`, side-by-side with the
unrelated SavoryMind product. Shared CI, deploy pipeline, and Docker
patterns; no shared domain code.

```
nocturna/
├─ backend/      FastAPI + Postgres (port 8001)
├─ frontend/     Next.js 14 App Router (port 3001)
├─ mobile/       Expo Router app (iOS / Android / Web)
├─ shared/       Cross-platform types, option constants, i18n dicts
└─ DEPLOY.md     Cloud Build / Cloud Run flow
```

Cloud Build deploys via `cloudbuild.nocturna.yaml` at the repo root.

## Stack at a glance

| Layer | Tech | Notes |
|---|---|---|
| Backend | FastAPI · SQLAlchemy 2 · PostgreSQL (or SQLite) | Pydantic v2, bcrypt 4.0.1 (passlib pin) |
| Web | Next.js 14 (App Router) · Tailwind · TypeScript | Server-rendered SEO, edge OG images |
| Mobile | Expo Router · React Native | Native push + location |
| Maps | Mapbox GL JS | SVG schematic fallback when no token |
| Payments | Stripe | Mock checkout when no key |
| Notifications | SendGrid · Twilio (SMS + WhatsApp) · Expo Push | Console fallback when no provider |
| AI Concierge | Anthropic Claude (tool-use) | Deterministic fallback when no key |
| Analytics | PostHog (frontend + server-side) | Silent no-op when no key |
| Deploy | Google Cloud Build → Cloud Run + Cloud Storage / Cloud SQL | |

Every paid integration degrades gracefully when its key is missing, so the
app runs end-to-end with zero secrets in dev.

## North star metrics

| Metric | First 30–60 days target |
|---|---|
| Visitors | 1,000 |
| Completed planners | 300 |
| Booking requests | 100 |
| Confirmed bookings | 25 |
| Partner venues | 20 |
| Paying promoted venues | 5 |
| Monthly revenue | €1,000 → €5,000 |

## Single source of truth

| File | Purpose |
|---|---|
| `nocturna/PROJECT.md` (this) | What & why. Stable. |
| `nocturna/REQUIREMENTS.md` | Functional + non-functional requirements. |
| `nocturna/ROADMAP.md` | Phased plan + open task XML blocks. |
| `nocturna/STATE.md` | Live execution state — updated every commit. |
