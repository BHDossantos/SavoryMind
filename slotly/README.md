# Slotly

> Tell us what you want. We book it for you.

A personal booking assistant for Rome. Users submit a request in plain text or
through a form (dinner, drinks, haircut, fitness class, nightlife, custom);
human concierges (admins) work the queue, contact venues, and confirm. Users
track status, approve alternatives, and see confirmations in one place.

This is the MVP scaffold described in the product brief. It implements the
end-to-end manual-concierge flow with the data model, status machine, and
admin tools, plus opt-in AI parsing of free-text requests and email
notifications. Deferred for later phases: payments, Google Places, partner
portal, and a mobile app.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **React 19**
- **Tailwind CSS**
- **SQLite** via `better-sqlite3` (no external DB to provision for the MVP)
- **bcryptjs** + **jose** JWT cookie sessions
- **zod** for input validation
- **@anthropic-ai/sdk** for AI parsing of natural-language requests (optional)
- **Resend** for transactional email (optional — falls back to console logging)

The schema in `src/lib/db.ts` is portable to Postgres for production.

## Getting started

```bash
cd slotly
cp .env.example .env.local      # then edit AUTH_SECRET
npm install
npm run seed                    # creates admin user + ~12 Rome businesses
npm run dev                     # http://localhost:3100
```

Default admin (override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env before seed):

```
admin@slotly.local / admin1234
```

## Demo flow

1. Sign up as a regular user.
2. Click **Book something for me** → fill the form (e.g. restaurant /
   Trastevere / 9 PM / 2 people / vibe "romantic"). If `ANTHROPIC_API_KEY`
   and `NEXT_PUBLIC_AI_PARSE=1` are set, the **Parse with AI** button turns a
   one-line description into populated form fields.
3. The system auto-matches up to 5 candidate businesses from the seed
   directory and creates a `submitted` request.
4. Log in as admin (`/admin`) → open the request:
   - Log a contact attempt (phone / WhatsApp / etc.)
   - Confirm the booking — tick *needs approval* if the time differs
   - Or set the status manually (searching, failed, completed…).
5. As the user, watch the status update on `/bookings/[id]`. If it's
   `needs_approval`, approve or reject the alternative. Each lifecycle event
   produces an email (logged to the dev console without `RESEND_API_KEY`).

## Status machine

```
submitted → in_review → searching → contacting → needs_approval → confirmed → completed
                                              ↘ failed
                                              ↘ cancelled (any time, by user)
```

Every transition is recorded in `status_history` with the actor and an
optional note. Every transition that affects the user (`needs_approval`,
`confirmed`, `failed`, `cancelled`, plus the initial in-progress nudge) fires
a notification, persisted in the `notifications` table with `delivered_at`.

## Data model

| Table | Purpose |
|---|---|
| `users` | Auth + profile, role = `user` \| `admin` |
| `businesses` | Venue directory (seeded with Rome examples) |
| `booking_requests` | The user's request + extracted fields |
| `candidate_businesses` | Top-5 ranked matches per request |
| `contact_attempts` | Concierge call/WhatsApp/email log |
| `confirmed_bookings` | Final venue + time + approval state |
| `status_history` | Audit log of every status transition |
| `notifications` | Outbound email log (subject, body, delivered_at) |

Matching is rule-based today (category + neighborhood + budget + vibe + tag
overlap + reliability). Defined in `src/lib/bookings.ts:matchCandidates`.

## API

| Method | Path | |
|---|---|---|
| POST | `/api/auth/signup` | |
| POST | `/api/auth/login` | |
| POST | `/api/auth/logout` | |
| GET / POST | `/api/booking-requests` | list mine / create |
| GET | `/api/booking-requests/:id` | detail (owner or admin) |
| POST | `/api/booking-requests/:id/cancel` | |
| POST | `/api/booking-requests/:id/approve-option` | |
| POST | `/api/booking-requests/:id/reject-option` | |
| POST | `/api/parse-request` | AI parse of free-text request → structured fields |
| GET | `/api/admin/booking-requests` | filter by `status` / `category` |
| PUT | `/api/admin/booking-requests/:id/status` | |
| POST | `/api/admin/booking-requests/:id/contact-attempt` | |
| POST | `/api/admin/booking-requests/:id/confirm` | |

## Deferred for later phases

- Stripe for priority/VIP fees — `priority` already lives on
  `booking_requests`; add a payments table + checkout session.
- Google Places — augment the seeded business directory.
- Partner portal — venue accounts that can accept/reject requests directly.
- React Native client.
- Move the `notifications` send loop to a queue / cron worker so a Resend
  outage doesn't drop events.

## What this scaffold does NOT do

- It does not actually contact any business. The "concierge" is whoever logs
  into `/admin`. That matches the brief's recommendation: start manual,
  automate later.
- It does not enforce the GDPR consent UI; the language is in the footer and
  on the booking form, but no consent record is persisted yet.
