<!-- generated-by: gsd-doc-writer -->
# Architecture

**Analysis date:** 2026-04-30

A two-tier app: FastAPI HTTP backend + Next.js HTTP frontend. Single SQLite database. In-process notification scheduler. Stripe + Resend integrations with stub fallbacks.

## High-level diagram

```
            ┌────────────────────────────────────────────┐
            │  Browser (PWA-capable Next.js 14 frontend) │
            │  port 3001                                 │
            └───────────────────┬────────────────────────┘
                                │  HTTP + JWT bearer
                                ▼
            ┌────────────────────────────────────────────┐
            │  FastAPI backend  (uvicorn @ port 8001)    │
            │  ┌────────────────────────────────────┐    │
            │  │ Routers: auth, providers, services,│    │
            │  │  availability, search,             │    │
            │  │  appointments, reviews, payments,  │    │
            │  │  admin                             │    │
            │  └────────────────────────────────────┘    │
            │  ┌────────────────────────────────────┐    │
            │  │ Services: availability_engine,     │    │
            │  │  notifications_service, security   │    │
            │  └────────────────────────────────────┘    │
            │  ┌────────────────────────────────────┐    │
            │  │ Clients: payments_client (Stripe), │    │
            │  │  email_client (Resend)             │    │
            │  └────────────────────────────────────┘    │
            │  ┌────────────────────────────────────┐    │
            │  │ APScheduler tick (every 60s)       │    │
            │  └────────────────────────────────────┘    │
            └────┬───────────────────────┬───────────────┘
                 │                       │
                 ▼                       ▼
        ┌──────────────────┐    ┌──────────────────────┐
        │ SQLite           │    │ Stripe + Resend      │
        │ slotly.db        │    │ (stub-mode when keys │
        │                  │    │  are unset)          │
        └──────────────────┘    └──────────────────────┘
```

## Backend layout

```
backend/
├── app/
│   ├── main.py                     FastAPI app, CORS, scheduler wiring
│   ├── config.py                   Pydantic settings (env-driven)
│   ├── db.py                       SQLModel engine + session
│   ├── models.py                   All tables (User, Provider, Service,
│   │                                Availability, BlockedTime, Appointment,
│   │                                Payment, Review, Notification)
│   ├── schemas.py                  Pydantic request/response models
│   ├── security.py                 JWT issuance + bearer auth dependency
│   ├── availability_engine.py      Slot computation + payment-aware busy logic
│   ├── notifications_service.py    Enqueue + render + process_due
│   ├── payments_client.py          Stripe Checkout wrapper + stub mode
│   ├── email_client.py             Resend wrapper + stub mode
│   ├── seed.py                     One-shot seed for 10 Rome barbers + demos
│   └── routers/
│       ├── auth.py                 /auth/{signup,login,me}
│       ├── providers.py            /providers/{me,:id}, /providers/:id/services
│       ├── services.py             /services CRUD (provider-owned)
│       ├── availability.py         /availability/mine + /providers/:id/slots
│       ├── search.py               /search/providers (filtered + ranked)
│       ├── appointments.py         booking + cancel + list
│       ├── reviews.py              /reviews + /providers/:id/reviews
│       ├── payments.py             /payments/{stub-confirm,webhook,:id}
│       └── admin.py                /admin/{dashboard,providers,bookings,
│                                    users,notifications}
├── requirements.txt
└── .env.example
```

## Frontend layout

```
frontend/
├── app/                            Next.js 14 App Router
│   ├── layout.tsx                  Root layout (Nav + body)
│   ├── globals.css
│   ├── page.tsx                    Landing
│   ├── search/page.tsx             Search results
│   ├── providers/[id]/page.tsx     Provider profile + reviews
│   ├── book/[serviceId]/page.tsx   Slot picker + booking
│   ├── booking/success/page.tsx    Post-Stripe redirect handler
│   ├── appointments/
│   │   ├── page.tsx                My appointments + cancel + review CTA
│   │   └── [id]/review/page.tsx    Star-picker review form
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── provider/                   Provider dashboard
│   │   ├── page.tsx                 Overview + KPIs
│   │   ├── profile/page.tsx
│   │   ├── services/page.tsx        Service CRUD + deposit toggle
│   │   └── availability/page.tsx    Weekly availability editor
│   └── admin/                      Admin panel (gated to Role.admin)
│       ├── layout.tsx               Tab nav
│       ├── page.tsx                 KPI dashboard
│       ├── providers/page.tsx       Approval queue + suspend
│       ├── bookings/page.tsx
│       ├── users/page.tsx
│       └── notifications/page.tsx
├── components/
│   ├── Nav.tsx                     Top nav with auth state
│   └── Stars.tsx                   Read or interactive star input
├── lib/
│   └── api.ts                      Typed client wrapping fetch + JWT
├── package.json, tsconfig.json, tailwind.config.js, next.config.js,
│ postcss.config.js, .env.example
```

## Key data-flow patterns

### Booking with deposit

```
client                       backend                      Stripe
  │  POST /appointments        │                              │
  ├──────────────────────────► │                              │
  │  service requires deposit  │                              │
  │                            │  create Appointment          │
  │                            │  (status=confirmed,          │
  │                            │   payment_status=pending)    │
  │                            │  create Payment              │
  │                            │  payments_client             │
  │                            │  ────────► create_session    │
  │                            │  ◄──────── checkout_url      │
  │  ◄─ BookingOut(checkout)   │                              │
  │  redirect to checkout_url  │                              │
  │                            │  customer pays               │
  │                            │  webhook ◄──────────────────│
  │                            │  payment_status=paid         │
  │                            │  enqueue notifications       │
  ▼                            ▼                              ▼
```

In **stub mode**, Stripe is skipped: `payments_client` returns a URL to `/booking/success?stub=1` which calls `/payments/stub-confirm/:id` to flip to paid.

### Notification lifecycle

```
booking event ─► enqueue_for_appointment(...)
                       │
                       ▼
              [Notification rows: confirmation + 24h + 2h]
                       │
                       ▼
   APScheduler tick (every 60s) ─► process_due ─► email_client.send_email
                                                       │ (or persist-only in stub)
                                                       ▼
                                                Notification.status = sent
```

Cancellation:
```
cancel ─► mark pending reminders as cancelled
       └► enqueue cancellation email (immediate)
```

### Slot computation

`availability_engine.compute_slots(provider, service_duration, window)`:
1. Pull provider's weekly `Availability` rows for each day in the window.
2. Pull `BlockedTime` overlapping the window.
3. Pull `Appointment` rows where `status=confirmed` AND `_payment_active(...)` (excludes pending-payment older than `PENDING_PAYMENT_TTL_MINUTES`).
4. Walk each working window in 15-minute steps, emit slots that fit `service_duration` and don't overlap any busy range.

### Search ranking

`search_providers` filters by category + city + (optional) `available_now ≤ 2h`, then sorts:
1. "Available now" providers first
2. Then by `next_slot` ascending
3. Then by rating desc (tiebreak)

## Trust + auth boundaries

- JWT bearer via `Authorization` header. `security.get_current_user` decodes; `require_role(...)` is the per-route gate.
- Public endpoints: search, public provider profile, public reviews list, slot lookup.
- Admin endpoints: gated to `Role.admin`.
- Approval gate: search + public profile only return `Provider.approval_status == approved`. New self-signup providers default to `pending`.

## State + side-effect summary

| What | Where | Reset / cleanup |
|---|---|---|
| User accounts | `User` table | manual delete via DB |
| Provider profile | `Provider` table | tied to user |
| Availability | `Availability` (weekly) + `BlockedTime` (one-off) | replaceable via `PUT /availability/mine` |
| Bookings | `Appointment` | cancellation flips status, doesn't delete |
| Payments | `Payment` (one-to-one with deposit appointments) | refunds tracked on the row |
| Reviews | `Review` (unique per appointment) | additive update on Provider rating |
| Notifications | `Notification` | scheduler drains; failures stay on row |

## What runs in-process vs out-of-process

In-process: APScheduler tick (`_process_due_tick` in `main.py`). One uvicorn instance = one tick loop. If we ever scale to multiple instances, move to a sidecar worker (a job for a future phase).

Out-of-process: nothing yet.
