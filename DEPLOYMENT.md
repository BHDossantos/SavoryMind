# Deployment Runbook

The end-to-end procedure for merging PR #18 and shipping it to production. Follow
top-to-bottom on merge day. Estimated time: 20-30 minutes if everything goes right,
1-2 hours if something needs rolling back.

---

## 1. Pre-merge checklist

### 1a. Verify all required Actions secrets are set

Repo → Settings → Secrets and variables → Actions. Confirm the following exist (you
don't need to know their values, just that they're present):

**Already set from prior deploys** — verify still there:

- `SECRET_KEY` (JWT signing)
- `SOCIAL_LOGIN_SECRET` (web NextAuth bridge)
- `ANTHROPIC_API_KEY` (Claude — assistant + recommendations + themes + trends + training)
- `CLOUD_SQL_PASSWORD` (Postgres root)
- Whatever GCP auth config the existing workflow uses (OIDC provider, service account)
- `SENTRY_DSN` (optional, no-op if unset)
- `RESEND_API_KEY` (optional, no-op if unset)

**New for PR #18** — must be added before merge:

| Secret | Required? | How to generate |
|---|---|---|
| `TOKEN_ENCRYPTION_KEY` | **Yes — blocking** | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `SPOTIFY_CLIENT_ID` | Optional | developer.spotify.com → app dashboard. Without it, `/api/oauth/spotify/*` returns 503. |
| `SPOTIFY_CLIENT_SECRET` | Optional | Same dashboard. |
| `GOOGLE_CLIENT_ID` | Optional | console.cloud.google.com → APIs & Services → Credentials. Without it, `/api/auth/google` returns 503. |

**Lifespan refuses to start in production if `TOKEN_ENCRYPTION_KEY` is unset or matches
the dev default.** That's a safety feature, not a bug. The deploy will fail loudly
rather than silently using the dev key for real OAuth tokens.

### 1b. Confirm Spotify redirect URI registered

If `SPOTIFY_CLIENT_ID` is set, the Spotify app dashboard must have this redirect URI
registered:

```
https://api.savorymind.net/api/oauth/spotify/callback
```

Without it, the OAuth round-trip will fail at Spotify's end with `INVALID_REDIRECT_URI`
and the user lands back on the social page with `?spotify=error&reason=token_exchange_failed`.

### 1c. Confirm Google client config (if using native sign-in)

The mobile build env (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`) and the backend env
(`GOOGLE_CLIENT_ID`) **must be the same value** — the verifier checks the token's `aud`
claim, which is set by the mobile client. Mismatch → 401 "Token audience mismatch".

### 1d. Check CI is green on the PR head commit

```
gh pr checks 18                                    # if you have gh CLI
# or visit https://github.com/BHDossantos/SavoryMind/pull/18 and look at the checks tab
```

All three jobs (Backend pytest, Frontend Jest, Mobile Jest) must be green. If any
are red, do not merge.

---

## 2. Merge

**Use squash-merge.** PR #18 has 30+ commits; per-feature history is useful for
bisecting if something regresses, but `main` doesn't need 30 entries. The commit
title GitHub generates from the PR title is fine; consider using the CHANGELOG's
"Activation prerequisites" section as the commit body.

After merge, the deploy workflow fires automatically.

---

## 3. Watch the deploy

```bash
# Either tail in real time:
gcloud run services logs tail savorymind-api \
  --region europe-west1 --project savorymind

# Or fetch the last 100 lines after the deploy completes:
gcloud run services logs read savorymind-api \
  --region europe-west1 --project savorymind --limit 100
```

### 3a. Lifespan startup check

You're looking for these log lines, in order, on the new revision:

```
INFO  [alembic.runtime.migration] Running upgrade ... -> 4490178aadd3, add spotify oauth token columns to social_connections
INFO  [alembic.runtime.migration] Running upgrade ... -> 2d78950e0987, add refresh_token_revocations table
INFO  [alembic.runtime.migration] Running upgrade ... -> d655b6eb282c, add review theme columns
INFO     Started server process
INFO     Waiting for application startup.
INFO     Application startup complete.
INFO     Uvicorn running on http://0.0.0.0:8080
```

If you see `RuntimeError: TOKEN_ENCRYPTION_KEY is the insecure default value`, the
secret wasn't picked up — check Actions secrets again. The new revision will fail
health checks and Cloud Run keeps the old revision serving traffic, so this is
recoverable without rolling back manually.

### 3b. Smoke-test the deployed backend

```bash
# Should return 200 with {"status":"ok","db":"ok"}
curl https://api.savorymind.net/health

# Should return the new auth response shape
curl -X POST https://api.savorymind.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a-real-test-account@example.com","password":"..."}'
# Look for: access_token in body, sm_refresh cookie in Set-Cookie header
```

### 3c. Verify the new endpoints exist

```bash
# Should return 401 (no refresh cookie) — proves the route is wired
curl -X POST https://api.savorymind.net/api/auth/refresh
# Expected: {"detail":"No refresh token."}

# Should return 503 (Google client_id not configured), OR 400 (configured but no body)
curl -X POST https://api.savorymind.net/api/auth/google
# Expected: {"detail":"Google sign-in is not configured on this server."} OR
#           {"detail":"`id_token` is required."}

# Should return 503 if Spotify env vars are unset
curl https://api.savorymind.net/api/oauth/spotify/start \
  -H "Authorization: Bearer <a real access token from /login>"
# Either: 200 with authorize_url, OR 503 if unconfigured
```

### 3d. Web smoke-test

1. Open https://savorymind.net/login in a fresh incognito window
2. Log in with a real test account
3. Look for: dashboard renders, no console errors, sentiment page shows the new
   "What guests are talking about" panel (only if reviews have been enriched
   since `ANTHROPIC_API_KEY` was set)
4. Hit the Spotify connect flow if `SPOTIFY_CLIENT_ID` is set:
   `/consumer/social` → "Connect Spotify" → grants → redirects back to social
   page with `?spotify=connected` query param

### 3e. Mobile smoke-test (real device)

This is the riskiest part — sandbox couldn't validate Reanimated 4 / RN 0.83 runtime
behavior. Things to check on first launch on a real device:

- App launches without crashing
- Login works (email/password — the email/password flow is fully tested)
- Dashboard renders: Pairings/Music/Recipes/Pantry/Journal/Connect tiles
- Notification bell appears top-right; tapping navigates to /notifications
- Spotify connect from social page works end-to-end if configured
- Music page shows real Spotify tracks (not just search URLs) when connected
- Assistant screen sends + receives without crashes
- Logout signs out cleanly

Common runtime regressions to watch for:

- **Reanimated 4 worklet errors**: any animation that uses `runOnUI` / shared values
  may need an audit. Errors usually surface as red-screen on entry to the affected screen.
- **RN 0.83 deprecated style props**: a handful of legacy props were removed. Most
  common ones are still supported.
- **vector-icons 14→15**: re-exports unchanged per their changelog; unlikely to break.

If something is broken, file a follow-up. Don't roll back the whole PR unless the
backend is the cause — the mobile changes don't affect web/backend users.

---

## 4. Rollback procedure

If the new backend revision fails health checks for >2 minutes, Cloud Run will keep
the previous revision serving traffic automatically. To force-route traffic back to
the previous revision:

```bash
# List revisions
gcloud run revisions list --service savorymind-api \
  --region europe-west1 --project savorymind --limit 5

# Send 100% of traffic to the previous revision (replace REVISION_NAME)
gcloud run services update-traffic savorymind-api \
  --region europe-west1 --project savorymind \
  --to-revisions REVISION_NAME=100
```

The Alembic migrations from PR #18 are **forward-only safe**: they only add columns
and a new table. The old revision still works against the migrated schema (it just
ignores the new columns/table). You don't need to roll back migrations.

If you ALSO need to revert the merge commit:

```bash
git revert -m 1 <merge-commit-sha>
git push origin main
```

This will re-trigger the deploy with the pre-PR-18 code. The new schema columns stay
in the DB; that's fine.

---

## 5. Post-deploy verification

After the deploy is healthy, give it 30 minutes and check:

1. **Sentry** (if `SENTRY_DSN` is set): no spike in errors. New errors at the start
   of a deploy are normal (cold start, schema discovery); ongoing errors aren't.
2. **Cloud Run metrics**: P95 request latency should be roughly the same as
   pre-deploy. If it doubled, the new `--min-instances 1` setting may be conflicting
   with concurrency settings — check the deploy log for the `gcloud run deploy` output.
3. **Dependabot security tab** (https://github.com/BHDossantos/SavoryMind/security/dependabot):
   the 10 alerts that were on the default branch should re-evaluate. Most should clear
   from the dependency bumps in PR #18.

---

## 6. Activate optional features

These are dormant until you set the relevant secrets — do them in any order, separately
from the main merge so issues are isolated.

### Spotify

1. Add `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` Actions secrets.
2. Trigger a manual deploy (push an empty commit, or re-run the deploy workflow
   from the Actions tab).
3. New deploy reads the secrets. `/api/oauth/spotify/start` switches from 503 to
   200 + authorize URL.
4. Test from a real account: `/consumer/social` → "Connect Spotify".

### Native Google sign-in

1. Add `GOOGLE_CLIENT_ID` to GitHub Actions secrets (server-side audience check).
2. Add `EXPO_PUBLIC_GOOGLE_CLIENT_ID` to mobile env (`eas.json` or `.env.production`)
   — same value as step 1.
3. Re-deploy backend.
4. Re-build mobile (`eas build --platform all`).
5. Test on a real device: tap Google tile on login screen, expect native sheet (not
   web browser).

### Anthropic / Claude

`ANTHROPIC_API_KEY` is already set from prior deploys. The new AI endpoints
(recommendations, trends, marketing, training, review themes, listening signal)
light up automatically as soon as PR #18 merges. No extra config needed beyond
ensuring the key still has quota.

---

## 7. Known caveats — refresher

These are documented in CHANGELOG.md but worth surfacing here:

- **No real-device smoke-test from the dev sandbox** — section 3e is the first time
  the mobile build runs against actual hardware. Expect 30-90 min of small fix-forward
  work if anything breaks.
- **Themes panel hides when no reviews are enriched yet** — restaurants on the new
  deploy see an empty panel only if `ANTHROPIC_API_KEY` is unset OR no reviews
  exist. Not a bug, by design. Backfilling old reviews to populate the panel is a
  separate one-off job (not in PR #18).
- **JTI revocation table grows unbounded over a long enough horizon** — pruned
  opportunistically on every refresh. Bounded by active-user × logouts/30d at current
  scale; switch to a cron when you cross 100k DAU.
- **Mobile SDK 54→55 was mechanical** — the Reanimated 3→4 worklet migration was the
  riskiest change. If a screen with shared values misbehaves on first device run, the
  fix is usually a 5-line `useSharedValue` → `useDerivedValue` swap.

---

## 8. After everything is green

1. Update the project README if needed.
2. Close any GitHub issues that PR #18 fixes.
3. Consider tagging this as a release: `git tag -a v2.0.0 -m "PR #18: security + AI + parity sweep"`
4. Take the rest of the afternoon off — that was 33 commits of work.
