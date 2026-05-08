# Deploying Nocturna

Cloud Build config: [`cloudbuild.nocturna.yaml`](../cloudbuild.nocturna.yaml) at the repo root.
Deploys `nocturna-api` (FastAPI) and `nocturna-web` (Next.js) to Cloud Run, side-by-side
with SavoryMind, sharing nothing except the project + region.

## One-time setup

1. **Enable services**
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
     containerregistry.googleapis.com storage.googleapis.com
   ```
2. **Grant Cloud Build the Cloud Run admin role** so it can deploy:
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
     --role=roles/run.admin
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
     --role=roles/iam.serviceAccountUser
   ```

## First deploy (placeholder URLs, then real ones)

```bash
gcloud builds submit \
  --config=cloudbuild.nocturna.yaml \
  --substitutions=\
_REGION=europe-west1,\
_SECRET_KEY=$(openssl rand -hex 32),\
_ADMIN_EMAIL=admin@nocturna.app,\
_ADMIN_PASSWORD=$(openssl rand -base64 24),\
_APP_BASE_URL=https://placeholder.example
```

The build prints both Cloud Run URLs on the last step. Re-run with the real
`_APP_BASE_URL=https://nocturna-web-…run.app` so CORS + Stripe success URLs
are correct.

## Optional integrations

Add any of these to `--substitutions=` when ready. All are optional — the
backend gracefully falls back to console-logged notifications and a mock
checkout if they're absent.

| Substitution | What it enables |
|---|---|
| `_STRIPE_SECRET_KEY` | Real Stripe checkout + webhook (use `sk_live_*` or `sk_test_*`) |
| `_STRIPE_WEBHOOK_SECRET` | Signature verification for the webhook endpoint at `/api/payments/webhook` |
| `_ANTHROPIC_API_KEY` | Claude-powered AI concierge with `generate_plan` tool-use |
| `_TWILIO_SID` / `_TWILIO_TOKEN` / `_TWILIO_FROM_SMS` | SMS via Twilio |
| `_TWILIO_FROM_WHATSAPP` | WhatsApp via Twilio (defaults to sandbox sender) |
| `_SENDGRID_KEY` / `_SENDGRID_FROM` | Transactional email via SendGrid |
| `_MAPBOX_TOKEN` | Real Mapbox maps; without it the SVG fallback renders |
| `_DATABASE_URL` | Override to a Cloud SQL Postgres URL for production scale |

## Database

By default the build provisions a GCS bucket and mounts it as a volume so the
backend can use **SQLite at `/data/nocturna.db`**. Cheap and zero-ops, but
single-instance only.

For production with multiple instances, move to **Cloud SQL Postgres**:

```bash
gcloud sql instances create nocturna-db \
  --database-version=POSTGRES_16 --tier=db-g1-small --region=europe-west1
gcloud sql databases create nocturna --instance=nocturna-db
gcloud sql users create nocturna --instance=nocturna-db --password='…'
# pass via _DATABASE_URL=postgresql+psycopg2://nocturna:…@/nocturna?host=/cloudsql/PROJECT:REGION:nocturna-db
```

When `_DATABASE_URL` is set, the build skips the GCS bucket step automatically.

## Webhook setup (Stripe)

1. Deploy once with `_STRIPE_SECRET_KEY` set.
2. In the Stripe Dashboard, add a webhook to `https://nocturna-api-….run.app/api/payments/webhook`
   listening for: `checkout.session.completed`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `invoice.payment_succeeded`,
   `charge.refunded`, `customer.subscription.*`.
3. Copy the resulting `whsec_…` into `_STRIPE_WEBHOOK_SECRET` and redeploy.
4. Trigger a test event from the Stripe Dashboard — verify it shows up in the
   admin notifications log at `/admin/notifications`.

## Booking reminders (Cloud Scheduler)

Nocturna has a reminder cron at `POST /api/cron/reminders` that scans bookings
starting in the next 60 minutes (`window_min` defaults to 30) and sends a
templated SMS + email + push if not already reminded. Idempotent — `reminder_sent_at`
is stamped on each Booking.

Authenticate with the bootstrap admin JWT, or with a shared secret in the
`X-Cron-Token` header. The backend reads the secret from
`NOCTURNA_CRON_TOKEN`; the same value is passed to the build via the
`_CRON_TOKEN` substitution.

### Auto-provisioned (recommended)

Set `_CRON_TOKEN` on your Cloud Build trigger and the build will
**create or update** a Cloud Scheduler job named `nocturna-reminders`
running every 15 minutes in `Europe/Rome` against the deployed API URL.
Re-deploys are safe — the job is updated in place.

```bash
gcloud builds submit --config=cloudbuild.nocturna.yaml \
  --substitutions=\
_REGION=europe-west1,\
_SECRET_KEY=$(openssl rand -hex 32),\
_CRON_TOKEN=$(openssl rand -hex 24),\
_APP_BASE_URL=https://nocturna-web-….run.app
```

The build step is a no-op when `_CRON_TOKEN` is unset (so PR-trigger
builds without the secret keep working).

### Manual (fallback)

If you'd rather provision the job by hand:

```bash
gcloud scheduler jobs create http nocturna-reminders \
  --schedule="*/15 * * * *" \
  --location=$REGION \
  --uri="https://nocturna-api-….run.app/api/cron/reminders" \
  --http-method=POST \
  --headers="X-Cron-Token=$CRON_TOKEN,Content-Type=application/json" \
  --message-body='{}' \
  --time-zone="Europe/Rome"
```

You can also kick it manually from any admin context:

```bash
curl -X POST "https://nocturna-api-….run.app/api/cron/reminders" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Verifying a deploy

```bash
curl https://nocturna-api-….run.app/api/health
# {"status":"ok","app":"Nocturna"}

curl https://nocturna-api-….run.app/api/cities | jq 'length'
# 10

curl https://nocturna-api-….run.app/api/venues/trending?city=rome | jq 'length'
# 8 (or up to your seeded count)
```

Then load the web URL in a browser, complete the planner quiz, and watch the
backend logs:

```bash
gcloud run services logs tail nocturna-api --region=europe-west1
```
