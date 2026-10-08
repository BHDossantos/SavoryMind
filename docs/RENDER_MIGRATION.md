# SavoryMind — migration to Render (off Google Cloud)

_Google Cloud account was terminated; the data there is unrecoverable. The
**code is intact in this repo**. This rebuilds the whole stack on **Render**:
backend + frontend + a managed Postgres with **automatic daily backups**, one
provider, one bill. The database starts **empty** (fresh start) — the app
auto-creates its schema on first boot (startup Alembic, hardened in PR #122)._

Everything in the repo is ready (`render.yaml` Blueprint). The steps below are
the parts only you can do (account, secrets, DNS).

---

## 1. Create the services (Blueprint) 🔑
1. Sign up at **render.com** (a paid workspace — needed for the backup-enabled DB).
2. **New → Blueprint → connect `BHDossantos/SavoryMind`**, branch `main`.
3. Render reads `render.yaml` and shows **3 resources**: `savorymind-db`
   (Postgres), `savorymind-api` (backend), `savorymind-web` (frontend).
   Confirm the plans (the DB must be a **paid plan so daily backups are on**),
   then **Apply**.

## 2. Set the secrets 🔑
Render prompts for every `sync: false` var. Set them per service.

### Backend (`savorymind-api`)
**Generate new** (don't reuse old GCP values):
- `SECRET_KEY` — `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `TOKEN_ENCRYPTION_KEY` — `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `SOCIAL_LOGIN_SECRET` — any long random string

**Reuse your existing keys** (from each provider's dashboard):
`ANTHROPIC_API_KEY`, `SENTRY_DSN`, `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`,
`APPLE_BUNDLE_ID`, `POSTHOG_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_RESTAURANT_PRICE_ID`, `STRIPE_RESTAURANT_TRIAL_DAYS`,
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE`.
(`DATABASE_URL` is wired automatically from the Render DB — don't set it.)

### Frontend (`savorymind-web`) — web login needs these
Without them, production **NextAuth has no secret, Google login shows as
unavailable, and the social-login bridge is rejected by the backend (403)** —
i.e. web sign-in is broken. (The mobile app logs in directly and is unaffected.)
- `NEXTAUTH_SECRET` — **generate new**: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `GOOGLE_CLIENT_SECRET` — reuse (same Google OAuth app as the backend)
- `NEXT_PUBLIC_POSTHOG_KEY` — reuse, or leave blank (analytics just no-ops)

`GOOGLE_CLIENT_ID` and `SOCIAL_LOGIN_SECRET` are **pulled automatically from
the backend** (`fromService` in the Blueprint), so the frontend's social
secret always matches the backend's — don't set them on the frontend by hand.
`NEXTAUTH_URL` and `BACKEND_URL` are set to the real domains in the Blueprint.

> The Stripe restaurant/consumer **Price IDs are still unset** — the billing
> tiers stay dormant until you create them (see `docs/NEEDS-BRUNO.md`). That's
> independent of the migration.

## 3. First deploy → verify healthy ✅
Both web services deploy from their Dockerfiles. Each has a health check:
- `savorymind-api` → `/` returns `{"message":"SavoryMind API v2"}` (DB-free, so it goes healthy even before the schema finishes).
- `savorymind-web` → `/` serves the marketing homepage.
On first boot the backend runs Alembic and **creates the full schema** in the
empty DB. Confirm both services show **Live** in Render.

## 4. Keep the same domains = almost nothing else to reconfigure
We deliberately keep **savorymind.net** and **api.savorymind.net**, so:
- The **mobile app** (points at `api.savorymind.net`) needs **no change**.
- **OAuth redirect URIs** (Google / Apple / Spotify) and the **Stripe webhook
  URL** (`api.savorymind.net/...`) stay valid — nothing to re-register.

## 5. DNS cutover 🔑
In Render, add custom domains:
- `savorymind.net` (+ `www`) → **savorymind-web**
- `api.savorymind.net` → **savorymind-api**
Render shows the DNS records to create; update them at your registrar. Render
auto-provisions TLS. Propagation is usually minutes.

## 6. Validate end-to-end ✅ (the "tested & validated" gate)
Fresh DB, so you're starting clean:
- `curl -s https://savorymind.net/calcolatore-spreco | grep -i "Quanto sta perdendo"`
- Sign up a test restaurant → onboarding → **take an order at a table → it
  appears on the kitchen display at the right station → bump to served** (the
  PR #128 feature, validated live for the first time here).
- One authed hit to `/api/restaurant/health-score` (confirms DB + schema).
- `docs/SEO_OPERATIONS.md` → Search Console submission.

## 7. Backups + alerting (so we never go dark again) ✅
- Confirm **daily automatic backups** are on for `savorymind-db` (paid plan).
- Add a Render **health-check alert** + a billing/usage alert so a failure
  pages you instead of sitting silent for weeks. (I can wire an uptime monitor
  + a startup self-check too — see the follow-up list.)

---

## What changed in the repo (done)
- `render.yaml` — the Blueprint (3 resources, env wired, health checks, auto-deploy on push to `main`).
- `.github/workflows/deploy-backend.yml` + `deploy-frontend.yml` → **`.disabled`**
  (dead GCP → Cloud Run deploys; Render now deploys natively on git push). CI
  test workflows (`ci.yml`, `mobile-ci.yml`) are untouched.
- Backend startup already hardened (PR #122) so it comes up even on a DB blip
  and self-heals the schema.

## Deploys from here on
Push to `main` → Render auto-builds + deploys both services. No GitHub Actions
deploy step. Roll back from the Render dashboard (one click) if a deploy misbehaves.
