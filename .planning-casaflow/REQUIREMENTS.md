# REQUIREMENTS — CasaFlow MVP scope

## Booking types
- **Instant booking** — fixed-price, standardized services (e.g.
  2-hour cleaning, TV mounting, IKEA assembly).
- **Quote request** — uncertain jobs, fan-out to multiple providers
  (e.g. bathroom leak, repainting an apartment).
- **Emergency dispatch** — urgent jobs with high-priority alerts and
  emergency-fee surcharge (lockout, leak, broken heater).
- **Recurring booking** — repeat services (weekly cleaning, monthly
  maintenance, Airbnb turnover).

## Customer requirements (must-have)
- Email/password + social signup; phone verification at first
  booking.
- Multi-address profile (apartment, house, office, Airbnb).
- Guided job request form: category → describe → photos → location
  → urgency → budget → preferred language.
- Provider search with filters: category, distance, availability,
  rating, price, language, verified status, emergency available.
- Quote comparison view.
- Booking flow with cancellation policy and deposit (when
  applicable).
- Job status timeline: requested → confirmed → on the way → arrived
  → in progress → completed → paid → reviewed.
- In-app chat per job.
- Cancel / reschedule with policy-aware refund logic.
- Review after completion (1–5 plus quality, punctuality,
  communication, price-accuracy).
- Notifications for state changes (in-app + email; SMS for
  emergency tier).

## Provider requirements (must-have)
- Provider signup (individual or company).
- Profile: bio, photo, service categories, service radius,
  languages, hourly rate, minimum fee, travel fee, emergency
  availability, documents (ID, optional license/insurance).
- Service catalog rows with pricing type (fixed, hourly,
  quote-required, diagnostic fee).
- Availability calendar: working hours, blocked time, emergency
  hours toggle.
- Job feed (new requests in categories I offer, or directly
  targeted at me).
- Quote builder: labor, materials, travel fee, platform fee,
  earliest start, valid-until, notes.
- Booking dashboard with status updates: on-the-way → arrived →
  in-progress → completed.
- Earnings dashboard: gross, platform fee, net payout, pending.
- Reviews feed.

## Admin requirements (must-have)
- Provider approval queue (identity, business info, documents).
- Job and booking monitoring.
- Dispute workflow (refund decisions, evidence review).
- Provider suspend / reinstate.
- Document expiration alerts.
- Category management.
- Basic KPI dashboard: jobs, conversions, GMV, take rate,
  cancellations.

## Trust & safety
- Verified providers only can take regulated categories (electrical,
  HVAC, gas, plumbing where licensed).
- License-required categories blocked until `license_status =
  verified`.
- Customer-reliability score and provider-reliability score (both
  start at 100, penalize no-shows / cancellations).
- Reviews allowed only after `status = completed`.
- Photo evidence required on disputes.
- Deposit captured on emergency and quote-accepted bookings.

## Payments
- MVP: 20% deposit on booking confirmation; remaining 80% captured
  on `completed`.
- Fixed-price instant bookings may capture full amount up front.
- Platform fee: 15% included in quote total (visible to customer
  and provider).
- Refund logic: pre-confirmation = full refund; ≥ 24h before
  scheduled start = full refund; < 24h = deposit forfeit unless
  provider fault; after `arrived` = no refund.
- Stripe Connect (or equivalent) for provider payouts.

## Languages (MVP)
- English and Italian for UI.
- Provider profiles store `languages: []` and customers can filter.

## Non-functional
- Mobile-first PWA; desktop usable.
- p95 page load < 3s on 4G.
- All sensitive endpoints rate-limited (5/min auth, 30/min general).
- Reviews and ratings are immutable after submission (admin can
  unpublish but not edit).
- Audit log for admin actions (approvals, suspensions, refunds).
- GDPR: data export and delete-my-account endpoints.

## Out of scope for MVP
- Native iOS/Android apps (revisit after PWA traction).
- WhatsApp Business integration (Phase 6+).
- Background check integrations.
- Insurance verification with external providers.
- Multi-currency (EUR only).
- Multi-city — single-city Rome only.
- Provider subscriptions / featured placement.
- Property profiles (just addresses for now).

## Data model summary
Tables (one row per entity):
`users`, `customer_addresses`, `providers`, `provider_documents`,
`provider_services`, `provider_availability`, `blocked_time`,
`service_categories`, `job_requests`, `job_media`, `quotes`,
`bookings`, `chat_messages`, `payments`, `reviews`, `disputes`,
`recurring_bookings`, `notifications`.

(Field-level schema lives in `docs/data-model.md`.)

## Categories (MVP)
Cleaning, Handyman, Plumbing, Furniture assembly.

## Categories (Phase 6+)
Moving, Painting, Appliance repair, Locksmith, Gardening,
Electrical, HVAC, Pest control, IT/Internet support, Renovation,
Property management, Airbnb turnover bundles.
