# Slotly — Requirements

Requirement IDs are stable. Status uses: `done`, `in_progress`, `planned`, `deferred`.

## v1 — Marketplace foundation

### Authentication & accounts

| ID | Requirement | Status | Phase |
|---|---|---|---|
| REQ-001 | Email + password signup with role selector (`customer` / `provider`) | done | 01 |
| REQ-002 | Login returns JWT bearer + user object | done | 01 |
| REQ-003 | `/auth/me` returns current user from bearer token | done | 01 |
| REQ-004 | Role-based gates on API (`require_role(...)`) | done | 01 |
| REQ-005 | Three demo accounts seeded (`customer`, `provider`, `admin`) | done | 04 |

### Provider profile + services + availability

| ID | Requirement | Status | Phase |
|---|---|---|---|
| REQ-010 | Provider can upsert own profile (`POST /providers/me`) | done | 01 |
| REQ-011 | Provider profile includes display name, bio, category, address, neighborhood, languages | done | 01 |
| REQ-012 | Provider can CRUD service menu (name, duration, price, deposit fields) | done | 01, 03 |
| REQ-013 | Provider can replace weekly availability windows | done | 01 |
| REQ-014 | Public profile lookup hidden for non-approved providers | done | 04 |

### Customer search & booking

| ID | Requirement | Status | Phase |
|---|---|---|---|
| REQ-020 | Search providers by category + city | done | 01 |
| REQ-021 | "Available now" filter — only providers with a slot ≤2h away | done | 01 |
| REQ-022 | Public providers list excludes pending / suspended providers | done | 04 |
| REQ-023 | Slot computation: working hours minus blocked time minus existing bookings | done | 01 |
| REQ-024 | Booking creates an Appointment with double-book protection (409) | done | 01 |
| REQ-025 | Customer can list own appointments | done | 01 |
| REQ-026 | Customer can cancel own confirmed appointment | done | 01 |
| REQ-027 | Provider can cancel any of their confirmed appointments | done | 01 |
| REQ-028 | Booking-in-the-past returns 400 | done | 01 |

### Reviews & ratings

| ID | Requirement | Status | Phase |
|---|---|---|---|
| REQ-030 | Customer can review own past appointment (1..5 stars + comment) | done | 02 |
| REQ-031 | One review per appointment (unique constraint, 409 on duplicate) | done | 02 |
| REQ-032 | Reviewing a confirmed past appointment auto-completes it | done | 02 |
| REQ-033 | Public provider profile lists recent reviews | done | 02 |
| REQ-034 | Provider rating + review_count update additively (preserve seeded demo) | done | 02 |
| REQ-035 | Appointments expose `has_review` / `can_review` to drive UI | done | 02 |

### Payments — Stripe deposits

| ID | Requirement | Status | Phase |
|---|---|---|---|
| REQ-040 | Service can require a deposit with a fixed cents amount | done | 03 |
| REQ-041 | Booking with deposit returns a Stripe Checkout URL; appointment in `payment_status=pending` | done | 03 |
| REQ-042 | Webhook `checkout.session.completed` flips payment + appointment to `paid` | done | 03 |
| REQ-043 | Stub mode (no `STRIPE_SECRET_KEY`): redirect to in-app success page that calls `/payments/stub-confirm/:id` | done | 03 |
| REQ-044 | Pending-payment slots block availability up to TTL (default 15 min); release after | done | 03 |
| REQ-045 | Customer cancellation >2h before start refunds; <2h forfeits deposit | done | 03 |
| REQ-046 | Provider-initiated cancellation always refunds | done | 03 |

### Admin panel

| ID | Requirement | Status | Phase |
|---|---|---|---|
| REQ-050 | New providers default to `approval_status=pending` | done | 04 |
| REQ-051 | Public search + profile lookup hide non-approved providers | done | 04 |
| REQ-052 | Admin can list providers filtered by approval status | done | 04 |
| REQ-053 | Admin can approve / suspend (with reason) a provider | done | 04 |
| REQ-054 | Admin dashboard KPIs: users, providers (incl. pending + suspended), bookings (today / 7d / cancellations), GBV, deposits held | done | 04 |
| REQ-055 | Admin can list bookings with status filter | done | 04 |
| REQ-056 | Admin can list users with role filter | done | 04 |
| REQ-057 | All `/admin/*` endpoints gated to `Role.admin` | done | 04 |

### Email notifications

| ID | Requirement | Status | Phase |
|---|---|---|---|
| REQ-060 | `Notification` table records every transactional email with status | done | 05 |
| REQ-061 | Resend integration with stub mode (no API key → persist + log only) | done | 05 |
| REQ-062 | Booking confirmation email enqueued at booking time (no-deposit) or at payment success (deposit) | done | 05 |
| REQ-063 | 24h and 2h reminders enqueued with the right `scheduled_at` | done | 05 |
| REQ-064 | Cancellation marks pending reminders as `cancelled` and enqueues a cancellation email | done | 05 |
| REQ-065 | APScheduler in-process tick drains due notifications (default every 60s) | done | 05 |
| REQ-066 | Admin can audit notifications + manually trigger the queue | done | 05 |
| REQ-067 | Idempotent enqueue — safe to call twice for the same appointment | done | 05 |

## v2 — Backlog (in priority order)

### Auto-fill cancellations (the killer feature)

| ID | Requirement | Status |
|---|---|---|
| REQ-100 | When a confirmed appointment is cancelled, find customers who searched the same `(category, city)` in the last N days (default 14) | done |
| REQ-101 | Notify those customers of the freed slot via email; cap at 20 recipients per broadcast; 24h per-user rate limit; exclude the canceller and anonymous searchers; skip past-dated slots | done |
| REQ-102 | Provider can manually flash-promote an open slot ("free in 30 min, 20% off") | planned |

### Real geosearch

| ID | Requirement | Status |
|---|---|---|
| REQ-110 | Provider profile carries lat/lng (Google Places autocomplete during signup) | planned |
| REQ-111 | Search supports radius filter; results sorted by distance | planned |
| REQ-112 | Map view on search results | planned |

### Disputes / refund workflow

| ID | Requirement | Status |
|---|---|---|
| REQ-120 | Customer can open a dispute on a paid appointment | planned |
| REQ-121 | Admin can issue a partial / full refund through Stripe from the dispute view | planned |
| REQ-122 | Provider sees dispute status on their dashboard | planned |

### Promotions

| ID | Requirement | Status |
|---|---|---|
| REQ-130 | Featured providers in search results (paid placement) | planned |
| REQ-131 | Provider-side discount codes | planned |
| REQ-132 | Last-minute offers surfaced under "Available now" | planned |

### Multi-channel notifications

| ID | Requirement | Status |
|---|---|---|
| REQ-140 | SMS reminders via Twilio (opt-in per user) | planned |
| REQ-141 | WhatsApp reminders via WhatsApp Business API | planned |
| REQ-142 | Push notifications via PWA / native | planned |

### Provider business tools

| ID | Requirement | Status |
|---|---|---|
| REQ-150 | Provider analytics: utilisation %, top services, cancellation rate, revenue trend | planned |
| REQ-151 | Multi-business / multi-employee accounts (`Business` table, owner role, employee roles) | deferred |
| REQ-152 | Provider subscription tiers (free / pro / premium) | deferred |
| REQ-153 | Provider portfolio (style tags + before/after photos) for skill-based search | deferred |

### Mobile

| ID | Requirement | Status |
|---|---|---|
| REQ-160 | PWA install prompt on the web frontend | planned |
| REQ-161 | Native iOS / Android via Expo | deferred |
