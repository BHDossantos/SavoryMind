# Nocturna

> *"Where should we go tonight, and how do we make the night amazing?"*

Nocturna plans curated nightlife itineraries (dinner → bar → club → late food) based on
vibe, budget, group, music, and location, then handles bookings, VIP tables, and group
voting. Web + mobile + admin + venue-partner dashboards. Multi-city ready (Rome, Milan,
Barcelona, Paris, Lisbon, Miami, New York, Dubai, Mykonos, Ibiza).

## Stack

| Layer    | Tech                                     |
|----------|------------------------------------------|
| Backend  | FastAPI · SQLAlchemy · PostgreSQL        |
| Web      | Next.js 14 (App Router) · Tailwind       |
| Mobile   | Expo Router · React Native               |
| Payments | Stripe (mock fallback in dev)            |
| Notifications | Twilio (SMS / WhatsApp), SendGrid, Expo Push, console fallback |
| AI Concierge | Anthropic Claude (graceful fallback) |
| Deploy   | Docker Compose / Cloud Run               |

## Quick start

```bash
cd nocturna
docker compose -f docker-compose.nocturna.yml up --build
```

- Web app: http://localhost:3001
- API:     http://localhost:8001  (`/api/health`)
- Admin login: `admin@nocturna.app` / `ChangeMe123!`

The backend seeds ~50 Rome venues + a starter set across the other 9 cities
on first boot. To re-seed, drop the `nocturna` database volume.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

Set `extra.apiUrl` in `mobile/app.json` to your machine's LAN IP if testing on a device.

## Run tests

```bash
cd backend
pip install -r requirements.txt
pytest
```

## Project layout

```
nocturna/
├─ backend/            FastAPI service (port 8001)
│  ├─ app/
│  │  ├─ api/routes/   auth, planner, venues, bookings, reviews,
│  │  │               group, events, payments, chat, partner, admin, cities
│  │  ├─ models/       SQLAlchemy ORM (User, Venue, Plan, Booking, Review,
│  │  │               Promo, Event, GroupPlan/Vote, Subscription, Payment,
│  │  │               ChatThread/Message, NotificationLog, PartnerProfile, City)
│  │  ├─ services/     recommender, scoring, notifications, payments, ai_chat
│  │  ├─ schemas/      Pydantic
│  │  └─ seed/         Rome + intl venue + city data
│  └─ tests/
├─ frontend/           Next.js 14 web (port 3001)
│  └─ src/app/         /, plan/new, plan/results, plan/share/[token],
│                      venues/[slug], bookings/new, bookings/[id],
│                      feedback/[planId], chat, groups/new, groups/[token],
│                      premium, payments/success|mock,
│                      me/plans, me/profile, login, signup,
│                      admin/* (dashboard, venues, bookings, promos, rules, cities, partners),
│                      partner/* (dashboard, profile, bookings, promos, events)
├─ mobile/             Expo Router app (iOS / Android / Web)
│  └─ app/             index, plan/new, plan/[id], venues/[slug],
│                      bookings/new|[id], feedback/[planId], chat,
│                      groups/new|[token], me/plans|profile, auth/login|signup
├─ shared/             Cross-platform types + option constants
└─ docker-compose.nocturna.yml
```

## Importing real venue data

Two ways to bring real Rome (or any-city) data into the database:

1. **Admin UI** → `/admin/import` — drop a CSV / JSON file, see a row-by-row
   diff in dry-run, then click *Commit*. Existing venues match on `slug` and are
   updated in place. Errors are reported per row without rolling back the
   successful ones.
2. **API** — `POST /api/admin/import/venues` (admin token):
   ```bash
   curl -F file=@nocturna/backend/app/seed/data/rome_venues_real.csv \
        -F dry_run=false \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        http://localhost:8001/api/admin/import/venues
   ```
   `GET /api/admin/import/template` returns the column spec and CSV header.

A starter set of **60 real Rome venues** ships in
`backend/app/seed/data/rome_venues_real*.csv` — restaurants, bars, speakeasies,
rooftops, clubs, live music, and late-night food, all with real addresses,
coordinates, opening hours, contact info, and Instagram handles. Drop them on
the admin importer to replace the placeholder seed.

## Recommendation engine

Rule-based weighted scoring (no LLM needed for the core loop). Weights:

```
location 0.20 · vibe 0.25 · budget 0.15 · time 0.15 · group 0.10 · quality 0.10 · promoted 0.05
```

Hard rules enforced in `services/recommender._hard_filter`:
- Closed venues are never returned.
- Clubs only after 23:30 local.
- High-end venues (price_level=4) blocked at the lowest budget band.
- Casual venues blocked for `intent` = `luxury` / `vip_table`.
- Dress mismatches > 1 level rejected.
- Promoted venues capped at 1 per plan.
- Total inter-stop travel > 30 min rejected unless user opts into long routes.

Tunable in real time via the Admin → Rules page.

## Business model wiring

- **Booking commission** — admin sets `commission_eur` when confirming a booking.
- **Venue subscriptions** — `subscription_venue_basic|pro|premium` Stripe checkout.
- **User concierge fees** — `instant_plan` (€4.99), `premium_date` (€19.99), `vip_concierge_*`.
- **User Premium** — `subscription_user` (€9.99/mo).
- **Promoted listings** — admin / partners set `promoted=true`, capped at 1 per plan, labelled.

When `NOCTURNA_STRIPE_SECRET_KEY` is unset, checkout sessions point to a local mock-confirm
page so you can complete the flow without real keys.

## Notifications

`services/notifications.py` provides email / SMS / WhatsApp / push with provider auto-detection:

- SendGrid → email, falls back to console log
- Twilio → SMS + WhatsApp, falls back to console log
- Expo → push, falls back to console log

Every send is recorded in `notifications_log`.

## AI Concierge

`services/ai_chat.py` uses the official Anthropic SDK (Claude) when `ANTHROPIC_API_KEY` is
set. The model gets a `generate_plan` tool that calls back into the rule-based recommender,
so AI suggestions still respect the hard rules. Without a key, a deterministic templated
assistant guides the user — the chat UI works either way.
