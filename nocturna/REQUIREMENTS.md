# Nocturna · Requirements

Requirements derived from the product brief and refined through Phases 1–7.
Each entry is tagged **[shipped]**, **[partial]**, or **[open]**, and links
to the file(s) that satisfy it. Anything **[open]** belongs in `ROADMAP.md`.

## 1. Functional — User app

### 1.1 Planner quiz [shipped]
9-step wizard (city → intent → time → vibe → music → budget → group → style → review)
covering every input from the brief. All ten cities, eleven intents, twenty
vibe tags, twenty-one music genres, nine group types, seven budget bands
(incl. VIP €500 / €1000 / €2000+).
- `frontend/src/components/planner/PlannerWizard.tsx`
- `mobile/app/plan/new.tsx`
- `shared/constants/options.ts`

### 1.2 Recommendation engine [shipped]
Rule-based weighted scorer (location 0.20 / vibe 0.25 / budget 0.15 /
time 0.15 / group 0.10 / quality 0.10 / promoted 0.05). Hard rules: closed
venues, club hours (excludes 06:00–17:00 daytime), price-floor for low
budgets, dress-code mismatch >1 level, capacity, promoted cap of 1 per
plan, total inter-stop travel ≤30 min unless `accept_long_route`. Returns
1–3 plans with deduped combinations and a fallback type-set when sparse
city data would otherwise return zero.
- `backend/app/services/recommender.py`
- `backend/app/services/scoring.py`
- `backend/tests/test_recommender.py` (7 tests)

### 1.3 Multi-stop "Book this plan" [shipped]
One submission books every stop in a plan: shared contact form, per-stop
override panel (skip / time / type / notes / VIP). Auto-derives request
type per venue type. Fans out notifications per stop. Plan flips to
`booked`.
- `backend/app/api/routes/bookings.py` (POST `/api/bookings/plan/{id}`)
- `frontend/src/components/booking/PlanBookingForm.tsx`
- `mobile/app/bookings/new.tsx`

### 1.4 Plan booking status board [shipped]
`/plan/{id}/bookings` (web + mobile) shows aggregate status pill
(none / pending / partial / confirmed) and per-stop status with venue
contact deep links (call / WhatsApp). Pull-to-refresh on mobile.

### 1.5 Plan share [shipped]
Per-plan `share_token`. `/plan/share/{token}` server-rendered, marked
noindex,follow. Branded OG image at `/og/plan/{token}`.

### 1.6 Venue catalog [shipped]
60 real Rome venues (restaurants, bars, speakeasies, rooftops, clubs,
live music, late-night food) with real addresses, opening hours, phone,
Instagram, websites. Starter sets for the other 9 cities.
- `backend/app/seed/data/rome_venues_real*.csv`
- `backend/app/seed/{rome_venues_part1..4,intl_venues}.py`

### 1.7 Venue detail [shipped]
Photo gallery (1/2/3+ adaptive layout), Mapbox map (SVG fallback), full
schema (hours, vibe, dress, price, contact), promos + events sections,
CTAs (reserve / VIP / directions / Instagram), HeartButton for favourites.

### 1.8 Saved venues / favourites [shipped]
Heart icon on venue detail + trending cards. Server-of-truth when authed
(`User.prefs.saved_venues`), localStorage fallback when guest. Saved
section on `/me/plans`.

### 1.9 AI Concierge [shipped]
Anthropic Claude tool-use with a `generate_plan` tool that calls back into
the rule-based recommender so AI suggestions still respect hard rules.
Deterministic templated assistant when no key.
- `backend/app/services/ai_chat.py`

### 1.10 Group voting [shipped]
Create group + invite token. Voters pick from candidate plans + register
own vibe/budget/music/neighborhood preferences. Close voting → tally
winner. (Web + mobile.)

### 1.11 Feedback / post-night reviews [shipped]
8 dimensions (overall, vibe accuracy, crowd, music, service, food, drinks,
price accuracy) + crowded level + would-return + comments. (Web + mobile.)

### 1.12 Near Me [shipped]
Geolocation prompt → `/api/venues/near?lat=&lng=&open_now=` — venues
ranked by haversine distance with optional open-now filter.

### 1.13 Booking reminders [shipped]
Cron endpoint at `POST /api/cron/reminders` scans bookings 30–60 min
ahead and sends templated email + SMS + push, idempotent via
`Booking.reminder_sent_at`. Cloud Scheduler invocation documented in
DEPLOY.md.

### 1.14 Mobile parity [shipped]
Expo Router app mirrors all user flows: home, planner with location,
results + native share, venue detail with native maps deep link, booking
(single + multi-stop), feedback, chat, groups, my plans, profile, auth.
Push notifications registered.

## 2. Functional — Admin app

### 2.1 Admin dashboard [shipped]
KPI tiles (users, venues, plans, booking requests, conversion, VIP, revenue,
subscriptions). CSV export buttons (bookings / payments / commissions).

### 2.2 Venue CRUD [shipped]
Full venue editor (all schema fields). Search. Promoted toggle.

### 2.3 Booking dashboard [shipped]
Rich card UI with inline action buttons (Mark pending, Confirm with
response + commission prompts, Reject with response, Mark completed,
WhatsApp venue, Call venue, Details). Search by name/phone/email,
VIP-only filter, status filter chips with counts. Reminder badge.

### 2.4 Notifications inspector [shipped]
Provider status pills (live vs console fallback). Send-test panel for any
channel. Delivery log with channel/status filters.

### 2.5 Recommendation rules [shipped]
Live weight tuner + hard-rule reference. Tuner persists to in-memory
`scoring.WEIGHTS` (next deploy resets).

### 2.6 Promotions list, cities list, partner assignment [shipped]
Read-only promos list. Cities list. Form to assign a registered user as a
partner with venue IDs.

### 2.7 CSV / JSON venue importer [shipped]
Drag-drop or paste, dry-run preview with per-row diff, idempotent upsert
by slug.

### 2.8 CSV exports [shipped]
Bookings, payments, commissions (per-venue rollup). 90-day default,
configurable up to 365.

## 3. Functional — Partner self-service [shipped]

Partner-scoped dashboard with analytics (top vibes, conversion, avg group
+ budget), venue list, promo + event creation, booking management with
status updates that fire user emails.

## 4. Payments

### 4.1 Stripe checkout [shipped]
Eight purposes wired (instant_plan, premium_date, vip_concierge_basic/pro,
subscription_user, subscription_venue_basic/pro/premium). Customer email
pre-fill. Falls back to a mock checkout page in dev.

### 4.2 Webhook hardening [shipped]
Real signature verification via `stripe.Webhook.construct_event`.
Idempotent at the event-id level via `webhook_events` table. Dispatches 9
event types. Receipt + failure templated emails. Subscription rows
created/updated. VIP concierge payments auto-flip the linked booking to
`pending`.
- `backend/app/services/payments.py`
- `backend/tests/test_payments.py` (7 tests)

## 5. Notifications

### 5.1 Multi-channel dispatch [shipped]
Email (SendGrid), SMS (Twilio), WhatsApp (Twilio), Push (Expo). Each
channel has a console-log fallback when its provider key is unset, so the
flow doesn't break in dev. Every send recorded in `notifications_log`.

### 5.2 Templated lifecycle [shipped]
booking_received / booking_confirmed / booking_rejected / booking_cancelled
/ booking_reminder / payment_receipt / payment_failed / subscription_active.
Centralised in `services/templates.py`.

### 5.3 Status-change wiring [shipped]
Admin and partner status updates fire the right templated message
(email + SMS + push) when a booking transitions.

## 6. SEO + sharing

### 6.1 Server-rendered metadata [shipped]
Per-venue + per-shared-plan pages compute title, description, canonical,
OpenGraph, Twitter card via Next.js `generateMetadata` (dynamic at request
time, 60 s revalidate).

### 6.2 JSON-LD structured data [shipped]
Per venue type (Restaurant / BarOrPub / NightClub) with PostalAddress,
GeoCoordinates, full OpeningHoursSpecification, priceRange, telephone,
sameAs, acceptsReservations. Organization + WebSite + SearchAction on
the root.

### 6.3 sitemap.xml + robots.txt [shipped]
`app/sitemap.ts` pulls live venues + cities. `app/robots.ts` allows public
pages and disallows /admin, /partner, /me, /api, /payments/mock.

### 6.4 Branded OG images [shipped]
`/og/plan/{token}` and `/og/venue/{slug}` edge routes generate 1200×630
PNGs with Nocturna branding via `next/og`.

## 7. PWA

`/manifest.webmanifest`, SVG icons (favicon, 192, 512), theme color,
apple-touch icons, app shortcuts. Install prompt component listens for
`beforeinstallprompt` with 7-day cooldown and PostHog tracking.

## 8. i18n

EN + IT dictionaries shipped from `shared/i18n/dictionaries.ts` (~90
keys). Locale provider with cookie persistence + `navigator.language`
autodetect. EN/IT switcher in header. Translated surfaces: home, planner,
results, venue detail, plan booking form, feedback, login, signup.

## 9. Analytics

PostHog frontend (lazy-imported, no-op without key) — `$pageview` on every
route change, `planner_submitted` / `plan_generated` / `plan_booked` /
`plan_shared` / `user_logged_in` / `user_signed_up` / `venue_saved_toggle` /
`install_prompt_*`. Server-side mirror at `services/analytics.py` for
events that must survive ad-blockers (booking_received, plan_generated,
plan_booked).

## 10. Non-functional

### 10.1 Rate limiting [shipped]
In-memory token bucket per IP on guest planner (20/min, burst 10) and
booking endpoints (10/min, burst 5; plan fan-out costs 2 tokens). Authed
users bypass. Best-effort within an instance lifetime — swap in Redis for
strict global enforcement.
- `backend/app/services/rate_limit.py`
- `backend/tests/test_rate_limit.py` (4 tests)

### 10.2 Deploy [shipped]
`cloudbuild.nocturna.yaml` deploys `nocturna-api` + `nocturna-web` on
Cloud Run side-by-side with SavoryMind. Default DB = SQLite-on-GCS;
`_DATABASE_URL` flips it to Cloud SQL Postgres (build skips bucket step).
17 substitutions wire optional providers. `Dockerfile.prod` for the
frontend (multi-stage, bakes `NEXT_PUBLIC_*`).

### 10.3 Tests [shipped]
- 37 backend pytest cases covering recommender, importer, payments
  (webhook idempotency + dispatch), notifications (templated lifecycle),
  reminders (cron idempotency), rate limit, saved venues, multi-stop
  booking flow.
- 3 Playwright e2e specs (golden path, venue detail, admin login).
- Frontend `tsc --noEmit` clean. `next build` passes (39 routes).

### 10.4 Auth [shipped]
JWT via `python-jose`. Bootstrap admin on first boot
(`admin@nocturna.app` / `ChangeMe123!`). Optional partner role.

### 10.5 Idempotency [shipped]
Stripe webhooks (event-id table). Booking reminders (`reminder_sent_at`).
Importer upsert by slug.

### 10.6 Graceful degradation [shipped]
Mapbox → SVG schematic. Stripe → mock checkout. Anthropic → templated
assistant. SendGrid/Twilio/Expo → console log. PostHog → silent no-op.

## 11. Open requirements (still on the roadmap)

These are **not yet shipped** — captured here so they don't get lost.

- **i18n coverage** — booking confirmation page, my-plans, premium, chat,
  groups, profile, admin/partner pages still English-only. Dict keys may
  need to be added.
- **Photo upload pipeline** — admins paste URLs today; a real upload
  (Cloud Storage + signed URLs) would unblock partners.
- **Streaming AI chat** — current concierge chat is request/response.
- **Email verification on signup** — accounts go live without verifying.
- **Per-plan "save to my plans" for guests** — guests' generated plans
  aren't accessible after they close the tab unless they share.
- **Booking confirmation deep link to add to phone calendar** — .ics
  attachment on the confirmation email would close a UX gap.
- **Production-grade rate limiter** — Redis-backed when traffic warrants.
- **Real venue photos** — seeded venues have empty `photos` arrays;
  needs a curation pass.
