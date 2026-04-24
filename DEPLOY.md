# SavoryMind — Production Deployment

Stack: **FastAPI on Google Cloud Run** · **Next.js on Google Cloud Run**

Both services are deployed via a single `cloudbuild.yaml` Cloud Build pipeline.

---

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated (`gcloud auth login`)
- Enable required APIs:
  ```bash
  gcloud services enable cloudbuild.googleapis.com run.googleapis.com \
    containerregistry.googleapis.com storage.googleapis.com
  ```
- Cloud Build service account needs **Cloud Run Admin** and **Storage Admin** roles

---

## Step 1 — Generate secrets

```bash
# Backend JWT secret
openssl rand -hex 32

# Shared social-login secret (must match on both services)
openssl rand -hex 32

# NextAuth secret (frontend only)
openssl rand -base64 32
```

Save all three — you'll pass them as Cloud Build substitution variables.

---

## Step 2 — First deploy (backend URL not yet known)

Run the build with a placeholder frontend URL. Cloud Build will:
1. Create a GCS bucket for the SQLite database
2. Build and deploy the **backend** to Cloud Run
3. Capture the backend URL automatically
4. Build and deploy the **frontend** using that URL

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions \
    _REGION=europe-west1,\
    _SECRET_KEY=<your-secret-key>,\
    _SOCIAL_LOGIN_SECRET=<your-social-secret>,\
    _NEXTAUTH_SECRET=<your-nextauth-secret>,\
    _NEXTAUTH_URL=https://placeholder.example
```

Build takes ~5–8 minutes. When done, get the live URLs:

```bash
gcloud run services describe savorymind-api --region europe-west1 --format "value(status.url)"
gcloud run services describe savorymind-web  --region europe-west1 --format "value(status.url)"
```

Note the **frontend URL** — looks like `https://savorymind-web-abc123-ew.a.run.app`.

---

## Step 3 — Second deploy (set real frontend URL)

Re-run with the actual frontend URL so NextAuth and CORS work correctly:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions \
    _REGION=europe-west1,\
    _SECRET_KEY=<same-secret-key>,\
    _SOCIAL_LOGIN_SECRET=<same-social-secret>,\
    _NEXTAUTH_SECRET=<same-nextauth-secret>,\
    _NEXTAUTH_URL=https://savorymind-web-abc123-ew.a.run.app
```

---

## Step 4 — Verify

| Check | URL |
|---|---|
| Backend health | `https://savorymind-api-xxx.a.run.app/health` |
| API docs | `https://savorymind-api-xxx.a.run.app/docs` |
| Frontend | `https://savorymind-web-xxx.a.run.app` |

1. Open the frontend URL and register a new account
2. Complete onboarding — you should land on your dashboard
3. Log out and log back in — should go straight to the dashboard

---

## Step 5 — CI/CD trigger (optional)

1. Cloud Build → **Triggers → Create trigger**
2. Connect `BHDossantos/SavoryMind` from GitHub
3. Config file: `cloudbuild.yaml`
4. Add all substitution variables (`_SECRET_KEY`, `_SOCIAL_LOGIN_SECRET`, etc.)
5. Trigger on pushes to `main`

---

## Custom Domain (optional)

1. Cloud Run console → **savorymind-web** → **Custom domains** → Map `savorymind.net`
2. Add the DNS records to your provider
3. Re-run build with `_NEXTAUTH_URL=https://savorymind.net` and `_CORS_EXTRA=https://savorymind.net`

---

## Social Login Providers (optional)

Add these to the **savorymind-web** Cloud Run service after deployment
(console → service → **Edit & deploy new revision** → **Variables & secrets**):

| Provider | Keys needed |
|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_ID`, `GITHUB_SECRET` |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| Twitter/X | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |

Providers whose vars are absent are hidden from the login page automatically.

---

## Cloud Run Notes

- **Cold starts**: services scale to zero when idle; first request after inactivity takes ~3–5 s
- **Database**: SQLite on a GCS-mounted volume — persists across restarts, no separate DB needed
- **Logs**: Cloud Run console → **Logs** tab, or `gcloud run logs read --service savorymind-api`
- **Scaling**: `--min-instances 0 --max-instances 2` keeps costs near zero at low traffic

---

## Troubleshooting

**CORS errors in browser**
→ Re-run build with correct `_NEXTAUTH_URL` and optionally `_CORS_EXTRA`

**`NEXTAUTH_SECRET` error on login**
→ Confirm `_NEXTAUTH_SECRET` substitution is set

**Onboarding loop after login**
→ Ensure you're on latest commit — fixed in `b8ed21a`

**Backend 500 on first request**
→ Check Cloud Run logs; likely a missing env var (`SECRET_KEY`, `SOCIAL_LOGIN_SECRET`)

**`RuntimeError: SECRET_KEY is the insecure default`**
→ Pass `_SECRET_KEY` in the build substitutions — do not leave the placeholder value
