# SavoryMind — Production Deployment

Stack: **FastAPI + PostgreSQL on Render** · **Next.js on Vercel**

---

## Prerequisites

- GitHub repo pushed (already done)
- [Render account](https://render.com) (free tier is fine)
- [Vercel account](https://vercel.com) (free tier is fine)

---

## Step 1 — Deploy the Backend (Render)

The `render.yaml` at the root of the repo configures everything automatically.

1. Log in to [render.com](https://render.com)
2. Click **New → Blueprint**
3. Connect your GitHub account and select the `BHDossantos/SavoryMind` repo
4. Render reads `render.yaml` and shows two resources:
   - `savorymind-db` — PostgreSQL free tier
   - `savorymind-api` — Docker web service
5. Click **Apply** — Render creates both and sets `DATABASE_URL` automatically
6. The first deploy takes ~3 minutes while Docker builds
7. Once live, visit `https://savorymind-api.onrender.com/health` — you should see `{"status":"ok"}`

### Grab the generated secrets

After the backend deploys:

1. In Render dashboard → **savorymind-api** → **Environment**
2. Note down the values for:
   - `SECRET_KEY` (auto-generated)
   - `SOCIAL_LOGIN_SECRET` (auto-generated)

You'll need `SOCIAL_LOGIN_SECRET` in Step 2.

---

## Step 2 — Deploy the Frontend (Vercel)

The `vercel.json` at the root of the repo configures the build.

1. Log in to [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Import `BHDossantos/SavoryMind` from GitHub
4. Vercel detects `vercel.json` → sets `rootDirectory: frontend` automatically
5. Before clicking **Deploy**, add these **Environment Variables** in the Vercel UI:

| Variable | Value |
|---|---|
| `NEXTAUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel URL, e.g. `https://savorymind.vercel.app` |
| `SOCIAL_LOGIN_SECRET` | Copy from Render dashboard (Step 1) |
| `NEXT_PUBLIC_API_URL` | `https://savorymind-api.onrender.com` |
| `BACKEND_URL` | `https://savorymind-api.onrender.com` |

6. Click **Deploy** — build takes ~2 minutes

### Update CORS on the backend

Once Vercel gives you the final URL (e.g. `https://savorymind-abc123.vercel.app`):

1. In Render dashboard → **savorymind-api** → **Environment**
2. Update `CORS_ORIGINS` to include your Vercel URL:
   ```
   ["https://savorymind-abc123.vercel.app","https://savorymind.net"]
   ```
3. Render auto-redeploys

---

## Step 3 — Verify

| Check | URL |
|---|---|
| Backend health | `https://savorymind-api.onrender.com/health` |
| API docs | `https://savorymind-api.onrender.com/docs` |
| Frontend | `https://your-app.vercel.app` |
| Keep-alive cron | `https://your-app.vercel.app/api/ping` |

1. Open the frontend URL, register a new account
2. Complete onboarding — you should land on your dashboard (no loop)
3. Log out and log in again — you should go straight to the dashboard

---

## Custom Domain (optional)

**Vercel:**
1. Vercel dashboard → Project → **Domains** → Add `savorymind.net`
2. Add the CNAME record Vercel shows to your DNS provider

**After adding domain:**
- Update `NEXTAUTH_URL` in Vercel env vars to `https://savorymind.net`
- Update `CORS_ORIGINS` in Render to include `https://savorymind.net`
- Trigger a redeploy on both platforms

---

## Social Login Providers (optional)

Add any of these in Vercel env vars — providers whose keys are absent are hidden from the login page automatically:

| Provider | Keys needed |
|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_ID`, `GITHUB_SECRET` |
| Facebook | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| Apple | `APPLE_ID`, `APPLE_SECRET` |
| Azure AD | `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| Twitter/X | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |

---

## Render Free Tier Notes

- The free PostgreSQL DB is deleted after **90 days** — upgrade to paid before then or export your data
- The free web service **sleeps after 15 min of inactivity** — the Vercel cron (`/api/ping` every 10 min) keeps it warm during business hours
- Cold starts take ~30 seconds if the service has been idle — first login after a long gap will be slow

---

## Troubleshooting

**`CORS` errors in the browser console**
→ Add your Vercel URL to `CORS_ORIGINS` in Render and redeploy

**`NEXTAUTH_SECRET` error on login page**
→ Set `NEXTAUTH_SECRET` in Vercel env vars and redeploy

**`onboarding_completed` looping**
→ Ensure you're on the latest commit — this was fixed in `2a89a91`

**Backend 500 on first request**
→ Check Render logs; likely a missing env var or DB connection issue

**`RuntimeError: SECRET_KEY is the insecure default`**
→ Render should auto-generate it; check that `generateValue: true` is set in `render.yaml`
