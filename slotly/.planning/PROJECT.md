# Slotly — Project Vision

> Real-time appointment booking for local services. Find who's available now, book instantly, and never waste time calling or texting again.

## One-line dev brief

A mobile-first web app that lets customers find and instantly book local service providers based on real-time availability, starting with **barbers in Rome**. Providers create profiles, list services, set availability, and manage bookings. Customers search by service / location / time / price / rating, book, get reminders, cancel/reschedule, and leave reviews. Admins approve providers, manage bookings, and monitor marketplace performance.

## Core promise

> Available now. Book instantly.

The killer feature is real-time availability. Most booking apps show businesses; Slotly shows **open slots**. The default search returns providers with bookable slots in the next 2h.

## Target market

**Launch slice:** men's grooming in Rome — Trastevere, Centro Storico, Monti, Testaccio, San Giovanni, Parioli, EUR, Prati.

**Why barbers first:**
- High repeat usage, short appointment time, simple service menu
- Strong loyalty behaviour, frequent last-minute demand
- Clear pricing → easy to compare → easy marketplace liquidity
- Many providers still rely on WhatsApp / Instagram for booking

**Expansion path:** hair salons → nails → lashes → brows → massage → makeup → wellness → fitness classes.

## User types

- **Customer** — books appointments
- **Provider** — barber, stylist, nail tech, massage therapist, etc.
- **Business owner** — owns a shop with multiple providers (deferred past v1)
- **Admin** — manages platform, verification, disputes

## Top problems Slotly solves

1. People do not know who is available right now
2. Customers waste time calling and texting
3. WhatsApp booking is messy; appointments get lost in messages
4. Providers lose money from empty slots; cancellations create wasted time
5. Customers do not trust random providers (need verification, reviews, photos)
6. Pricing is unclear before booking
7. Providers struggle with no-shows
8. New providers struggle to get clients (need discovery + promotion)
9. Customers want skill-based search (fade, beard trim, curly hair, balayage, nail art, deep tissue, …)
10. Booking across languages is hard (Rome has tourists + expats)
11. Providers use poor scheduling tools — most small shops have nothing
12. Customers forget appointments → reminders needed
13. Providers do not understand their business performance — need analytics

## What Slotly is NOT

- Not Booksy. Booksy shows businesses; Slotly shows **open slots**.
- Not a calendar tool. The calendar is the engine; the product is the marketplace.
- Not a Yelp. Reviews exist to grease the booking flow, not to be the destination.

## Decisions locked for v1

- **Stack:** FastAPI + SQLModel backend, Next.js 14 (App Router) + Tailwind frontend, SQLite by default with Postgres-ready `DATABASE_URL`.
- **Auth:** JWT bearer (no Supabase / Auth0 yet — not worth the dependency).
- **Payments:** Stripe Checkout for deposits, with **stub mode** when `STRIPE_SECRET_KEY` is unset so the deposit + refund flow is exercisable without real keys.
- **Email:** Resend for transactional + reminders, with **stub mode** when `RESEND_API_KEY` is unset.
- **Scheduler:** APScheduler in-process for the notification tick. Move to a sidecar worker if we ever outgrow a single-instance backend.
- **No mobile app in v1.** PWA via the Next.js frontend. Native Expo deferred to v2.
- **Single-city launch (Rome).** Location is a city-string match for now; lat/lng + radius search is v2.
- **No multi-business accounts in v1.** One provider profile = one user account. Multi-employee shops can self-organise via separate accounts until the data model needs warrant a `Business` table.

## Success criteria (90 days post-launch)

- 50 verified barbers in Rome
- 500 customer signups
- 150 completed bookings
- ≥30 repeat bookings
- Cancellation rate <15%, no-show rate <8%

## Out of scope for v1 (intentional cuts)

Multi-business accounts, native mobile app, push notifications, SMS / WhatsApp, real geosearch (Google Places + radius), auto-fill-cancellation broadcasts, promotions / featured providers, provider subscriptions, dispute workflow beyond a manual admin tab, provider analytics beyond a 3-tile dashboard.
