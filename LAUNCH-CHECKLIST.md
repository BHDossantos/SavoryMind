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
| `STRIPE_RESTAURANT_PRICE_ID` | Restaurant €99/mo subscription | **Shipped.** Set this (a recurring €99/mo Price id from the Stripe dashboard) to turn on the `/restaurant/billing` checkout. Leave unset and the page shows "billing not available yet". |
| `STRIPE_RESTAURANT_TRIAL_DAYS` | Restaurant trial length | Optional. Set to `60` to run the pilot as "card now, first charge after 60 days"; leave unset/`0` to charge immediately (hand-managed conversion). |

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

### 6a. One-URL readiness check (do this first)

After you've set the secrets above and the backend has redeployed, log
in once and hit `GET https://api.savorymind.net/health/deep` from your
browser's devtools (or `curl -H "Authorization: Bearer <token>"`).

You'll get a JSON snapshot of every pilot integration with one of three
states per item:

  - `enabled` — configured and ready
  - `misconfigured` — partially set (e.g. Twilio SID without auth token,
    Stripe secret without webhook). **Real bug; fix before launch.**
  - `dormant` — not configured (feature stays off, the rest of the app
    still works)

For a full pilot launch, every one of these should read `enabled`:

```
integrations:
  resend            (booking emails, reminders, briefings)
  twilio            (SMS alerts to restaurants)
  stripe_consumer   ($9.99/mo Premium)
  stripe_restaurant (€99/mo restaurant plan)
  anthropic         (Flavor, Mood-to-Meal, Snap-a-Menu)
  google_signin     (mobile native sign-in)
  apple_signin      (mobile native sign-in — required for iOS)
  posthog           (funnel analytics)
  sentry            (error tracking)
  cloud_scheduler   (reminder + briefing crons)
  token_encryption  (Fernet key, must NOT be `dev_key` in prod)
```

A single `misconfigured` is the only reading worth blocking the
launch on. `dormant` is fine if you've explicitly decided to skip a
feature for the pilot. The response never includes secret VALUES — it
only reports presence — so it's safe to paste in slack while debugging.

### 6b. End-to-end smoke

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

The restaurant billing flow is **shipped** (`/restaurant/billing`,
`/api/billing/restaurant/*`). Day 60 plan:

1. In the Stripe dashboard, create a recurring **€99/mo** Price for the
   restaurant product. Copy its `price_…` id.
2. Set the `STRIPE_RESTAURANT_PRICE_ID` GitHub secret to that id (and
   re-run the backend deploy). The existing `STRIPE_SECRET_KEY` +
   `STRIPE_WEBHOOK_SECRET` are reused — one webhook serves both products.
3. Add the restaurant product to the **same** Stripe webhook endpoint
   (`/api/billing/webhook`) — it already handles `checkout.session.completed`
   and `customer.subscription.*` for both plans. No new endpoint needed.
4. Email pilot restaurants: "Trial ends soon — subscribe here:
   savorymind.net/restaurant/billing". They check out, the webhook flips
   their `plan` to `pro`, and the billing page shows "You're subscribed".
5. (Optional) Set `STRIPE_RESTAURANT_TRIAL_DAYS=60` *before* onboarding a
   cohort if you'd rather collect the card on day 1 with the first charge
   deferred — Stripe then auto-converts, no day-60 email needed.

Entitlement note: a restaurant's `plan` becomes `pro` while the
subscription is active/trialing, `free` when canceled. The dashboard is
**not** hard-gated on `pro` — a lapsed subscription shows a renew nudge
rather than bricking the restaurant mid-service. Tighten later if needed.

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
