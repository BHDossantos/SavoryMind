# SavoryMind — Italian Pilot Launch Checklist

Everything that has to be true in production before you tell the first
restaurant their link works. Walk through top to bottom. Each item is
either ✅ already shipped in code or 🛠 you have to do it.

---

## 1. Secrets in GitHub Actions

`Settings → Secrets and variables → Actions` on the repo. The deploy
workflows reference these by name; an empty secret = the feature
silently no-ops in production.

### Required for pilot

| Secret | Used by | Behavior if unset |
| --- | --- | --- |
| `RESEND_API_KEY` | Booking emails, reminders, daily briefing | Email sends silently skipped |
| `TWILIO_ACCOUNT_SID` | Booking SMS alerts to restaurant | SMS silently skipped |
| `TWILIO_AUTH_TOKEN` | Booking SMS alerts to restaurant | SMS silently skipped |
| `TWILIO_FROM_PHONE` | Booking SMS alerts (E.164, e.g. `+15555550100`) | SMS silently skipped |
| `SCHEDULER_SERVICE_ACCOUNT` | OIDC-gated internal cron endpoints | `/internal/jobs/*` returns 503 |
| `SCHEDULER_AUDIENCE` | OIDC-gated internal cron endpoints | `/internal/jobs/*` returns 503 |

### Already in place (don't touch)

`SECRET_KEY`, `SOCIAL_LOGIN_SECRET`, `ANTHROPIC_API_KEY`,
`CLOUD_SQL_PASSWORD`, `SENTRY_DSN`, `SPOTIFY_CLIENT_ID`,
`SPOTIFY_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`,
`APPLE_BUNDLE_ID`, `POSTHOG_API_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.

### For post-pilot (day 60+)

| Secret | Used by | Notes |
| --- | --- | --- |
| `STRIPE_RESTAURANT_PRICE_ID` | Restaurant €99/mo subscription | Not yet wired — comes when self-serve billing ships |

---

## 2. Cloud Scheduler jobs

GCP Console → Cloud Scheduler in the `savorymind` project, region
`europe-west1`. Each job posts an empty body to the listed URL with
OIDC auth (service account: `scheduler@savorymind.iam.gserviceaccount.com`
or whatever your existing inventory-digest job uses — same one).

| Cron | Target URL | Purpose |
| --- | --- | --- |
| `*/15 * * * *` | `https://api.savorymind.net/internal/jobs/booking-reminders` | 24h-before reminder to diners. Idempotent per booking. |
| `0 7 * * *` | `https://api.savorymind.net/internal/jobs/daily-briefing` | Morning email to each restaurant with today's bookings (08:00 Rome). |
| `0 6 * * 1` | `https://api.savorymind.net/internal/jobs/inventory-digest` | Weekly inventory digest (existing). |

For each: `Auth header` → `Add OIDC token`, audience matches
`SCHEDULER_AUDIENCE`.

---

## 3. Domain mappings

Already wired by `deploy-backend.yml` and `deploy-frontend.yml`:

- `api.savorymind.net` → backend Cloud Run service (`savorymind-api`)
- `savorymind.net` / `www.savorymind.net` → frontend Cloud Run service (`savorymind-web`)

After first deploy, confirm in Cloud Run → Manage Custom Domains
that both records are `Active` and the SSL certs say `Active`. DNS
records are CNAMEs to `ghs.googlehosted.com` (mapped automatically
by `gcloud run domain-mappings create`).

---

## 4. Database migrations

Runs automatically on Cloud Run startup via the FastAPI lifespan in
`backend/main.py` — `alembic upgrade head` against the Cloud SQL
instance. **No manual step needed.** After a deploy, tail the Cloud
Run logs and look for `Running upgrade ...` lines to confirm the
new migrations applied:

```
b3e9f1a72c84 → c8d2e4f6a193 (users.phone)
c8d2e4f6a193 → d9f4a2e1b56c (users.slug)
d9f4a2e1b56c → e7b3c9d12a4f (bookings.reminder_sent_at)
```

---

## 5. Pilot-specific: Italian restaurant invitation kit

Once the above is green, every Italian pilot restaurant you signed up
should:

1. **Sign up** at `savorymind.net/signup` as a restaurant account.
2. **Complete onboarding** (7 steps, all Italian).
3. **Set their alert phone** on the bookings page so SMS arrives.
4. **Grab their link** from the "Il tuo link prenotazioni" widget
   on the bookings page — copy → paste into their next WhatsApp
   broadcast to existing diners.

Sample WhatsApp text they can copy (for you to share with them):

> Ciao! 👋 Abbiamo un nuovo modo per prenotare: in 30 secondi e
> senza scaricare nulla. Ecco il link → https://savorymind.net/r/SLUG
> Ti aspettiamo!

---

## 6. Smoke test before going live

In production, on the deployed app:

1. ☐ Sign up a test restaurant (e.g. `pilot-smoketest@savorymind.net`).
2. ☐ Complete onboarding in Italian.
3. ☐ Set the alert phone in the bookings page (your own phone for the test).
4. ☐ Open the share link in a private window — booking page loads in Italian.
5. ☐ Submit a guest booking. Expect:
   - Confirmation page reads "Prenotazione confermata!" (or "Richiesta inviata" if no slots).
   - Restaurant dashboard polls the new booking within ~10s and chimes.
   - Restaurant gets an email within ~30s.
   - Restaurant gets an SMS to the alert phone within ~30s.
6. ☐ Wait 24h, verify the reminder cron sends the diner a reminder
   (or fast-forward by inserting a booking with `date = tomorrow` in
   the DB and waiting one cron tick).
7. ☐ Next morning, verify daily briefing email arrived.

If any of those fail, check Cloud Run logs and the Resend/Twilio
dashboards for the actual API response.

---

## 7. After pilot — convert to paid

Day 60 plan:
1. Configure `STRIPE_RESTAURANT_PRICE_ID` (a recurring €99/mo Price
   in the Stripe dashboard).
2. Ship the restaurant billing flow (currently deferred, not in code).
3. Email pilot restaurants: "Trial ends in 7 days, here's the
   checkout link."
4. Auto-flip `plan` on the restaurant User row when the Stripe webhook
   fires `customer.subscription.created`.

---

## Quick reference — endpoints

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/public/restaurants/{slug}` | GET | none | Restaurant info + 14d availability |
| `/api/public/restaurants/{slug}/book` | POST | none, rate-limited | Guest booking |
| `/api/restaurant/bookings` | GET | restaurant | List today/future bookings |
| `/api/restaurant/bookings/{id}/confirm` | PATCH | restaurant | Mark pending → confirmed |
| `/api/auth/profile` | PATCH | any | Set restaurant.phone, restaurant.language, slug auto-generates from restaurant_name |
| `/internal/jobs/booking-reminders` | POST | OIDC | Day-before reminders |
| `/internal/jobs/daily-briefing` | POST | OIDC | Morning summary |

---

## Reach me

If anything's red and you can't tell why, the Cloud Run logs for
`savorymind-api` plus the corresponding GitHub Actions run for the
last deploy will have the answer ~95% of the time. Sentry catches
the rest.
