# Deploying Nocturna

**Primary stack (what this project actually targets):**

| Layer | Host | Config |
|---|---|---|
| Database | **Supabase Postgres** | connection string → Render env |
| Backend (FastAPI) | **Render** (Docker) | [`render.yaml`](../render.yaml) at repo root |
| Frontend (Next.js) | **Vercel** | `nocturna/frontend` + [`vercel.json`](./frontend/vercel.json) |
| Reminder cron | **GitHub Actions** | [`.github/workflows/nocturna-reminders.yml`](../.github/workflows/nocturna-reminders.yml) |
| Mobile builds | **Expo EAS** | `nocturna/mobile/STORE_SUBMISSION.md` |

The app was built env-driven from day one, so no code changes are needed
for any host — only environment variables. (A legacy Google Cloud Run
path still exists in `cloudbuild.nocturna.yaml`; see the appendix.)

---

## 1 · Database — Supabase

1. In the [Supabase dashboard](https://supabase.com/dashboard), restore
   your paused project or create a new one named **Nocturna**.
2. Project → **Connect** → copy the **Transaction pooler** URI (port 6543):

   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```

That's it. The backend creates its own tables on first boot
(`Base.metadata.create_all`) and seeds 10 cities, ~90 venues, and the
bootstrap admin. No migrations to run by hand.

> RLS note: the backend connects as `postgres` via its own API layer, so
> Supabase Row Level Security is not used. Don't expose the anon key —
> this deployment uses Supabase purely as managed Postgres.

## 2 · Backend — Render

1. Render dashboard → **New → Blueprint** → select this GitHub repo.
   Render reads [`render.yaml`](../render.yaml) and provisions
   `nocturna-api` (Docker build from `nocturna/backend/Dockerfile`,
   health-checked on `/api/health`, 1 GB persistent disk mounted at
   `/data` for photo uploads).
2. Fill the prompted secrets:
   - `NOCTURNA_DATABASE_URL` — the Supabase pooler URI from step 1
   - `NOCTURNA_ADMIN_BOOTSTRAP_PASSWORD` — pick one, rotate after first login
   - `NOCTURNA_APP_BASE_URL` + `NOCTURNA_CORS_ORIGINS` — your Vercel URL
     (placeholder first, update after step 3)
   - optional provider keys (Stripe, Twilio, SendGrid, Anthropic, Sentry) —
     every one falls back gracefully when unset
3. Deploy. Note the service URL, e.g. `https://nocturna-api.onrender.com`.

## 3 · Frontend — Vercel

1. Vercel dashboard → **Add New → Project** → import this repo.
2. **Root Directory:** `nocturna/frontend` (framework auto-detected: Next.js).
3. Environment variables:

   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the Render URL from step 2 |
   | `NEXT_PUBLIC_SITE_URL` | this deployment's public URL (set after first deploy) |
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | optional — SVG fallback without it |
   | `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | optional |

4. Deploy, then go back to Render and set `NOCTURNA_APP_BASE_URL` +
   `NOCTURNA_CORS_ORIGINS=["https://<your-vercel-url>"]` to the real URL.

## 4 · Reminder cron — GitHub Actions

The workflow pings `POST /api/cron/reminders` every 15 min (idempotent).
Add two repo secrets (Settings → Secrets and variables → Actions):

- `NOCTURNA_API_URL` — the Render URL
- `NOCTURNA_CRON_TOKEN` — copy the value Render generated for the
  `NOCTURNA_CRON_TOKEN` env var

Until the secrets exist the workflow exits as a no-op warning, so it's
safe to merge first and wire later. Trigger a manual run (workflow_dispatch)
to test.

## 5 · Stripe webhook

1. Stripe Dashboard → Webhooks → add endpoint
   `https://<render-url>/api/payments/webhook`, listening for:
   `checkout.session.completed`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `invoice.payment_succeeded`,
   `charge.refunded`, `customer.subscription.*`.
2. Copy the `whsec_…` into Render env `NOCTURNA_STRIPE_WEBHOOK_SECRET`
   (and the API key into `NOCTURNA_STRIPE_SECRET_KEY`). Redeploy.
3. Send a test event from Stripe; check `/admin/notifications` for the
   receipt email log.

## 6 · Verifying a deploy (automated)

```bash
python3 nocturna/scripts/smoke.py \
  https://nocturna-api.onrender.com \
  https://<your-vercel-url>
```

Exit 0 = green. It exercises health → seeding → planner → guest booking →
share round-trip plus the web legal/SEO endpoints, and creates one
clearly-labelled test booking ("SMOKE TEST — ignore") — reject it from
`/admin/bookings` afterwards.

## 7 · Error monitoring (optional)

Set `NOCTURNA_SENTRY_DSN` on Render to enable Sentry on the backend.
PII is never sent (`send_default_pii=False`); traces sample at 10%
(`NOCTURNA_SENTRY_TRACES_RATE`).

## 8 · Mobile

Nothing in this document affects EAS — follow
[`mobile/STORE_SUBMISSION.md`](./mobile/STORE_SUBMISSION.md). Set
`NOCTURNA_API_URL` in `mobile/eas.json` build profiles to the Render URL.

## Costs at launch

| Item | Monthly |
|---|---|
| Supabase (free tier) | $0 |
| Render starter | $7 (or $0 on free with cold starts) |
| Vercel hobby | $0 |
| GitHub Actions cron | $0 (public repo) / pennies (private) |
| **Total** | **~$7/mo** until traffic justifies more |

---

## Appendix · Legacy Google Cloud Run path

`cloudbuild.nocturna.yaml` (repo root) still deploys the same containers
to Cloud Run with SQLite-on-GCS or Cloud SQL, auto-provisioning a Cloud
Scheduler reminder job. It is kept for teams already on GCP; it is **not**
the primary path. Run with:

```bash
gcloud builds submit --config=cloudbuild.nocturna.yaml \
  --substitutions=_REGION=europe-west1,_SECRET_KEY=$(openssl rand -hex 32),_CRON_TOKEN=$(openssl rand -hex 24),_APP_BASE_URL=https://placeholder.example
```
