# Nocturna · State

> Live execution state. Update this file with **every** atomic commit.

## Branch

`claude/nocturna-night-planning-app-l6Rut`
(based on `main` from the SavoryMind monorepo)

## Last shipped

- **Commit:** `cdbcdc9`
- **Title:** feat(nocturna): GSD t-replatform — Supabase + Render + Vercel deploy path
- **Phase:** 15 · Re-platform

## In flight

None. Working tree clean.

## Local environment health

| Check | Status | Notes |
|---|---|---|
| `pytest tests` (backend) | **69 passed** | bcrypt 4.0.1 pinned; +1 account-deletion test |
| `tsc --noEmit` (frontend) | **clean** | |
| `tsc --noEmit` (mobile) | **clean** | First ever — SDK-54-aligned deps, 16/18 expo-doctor |
| `scripts/smoke.py` | **7/7** | Verified against locally booted uvicorn + seed |
| `next build` (frontend) | **clean** | 42 routes; /privacy + /terms static |
| `playwright test` | **3/3 PASS** | Executed in real Chromium via CHROMIUM_BIN headless shell |

## Production health

Untested in production. Primary path is now **Supabase (Postgres) +
Render (API via render.yaml) + Vercel (web) + GitHub Actions (reminder
cron)** — see DEPLOY.md. The user's Supabase account has a paused free
project that can be restored, or create a fresh "Nocturna" project.
Cloud Run (`cloudbuild.nocturna.yaml`) is a legacy appendix. Verify any
deploy with:

```bash
python3 nocturna/scripts/smoke.py https://<api-url> https://<web-url>
```

## Open questions / known issues

- **Mobile i18n** — Expo strings still English-only. Want to share the
  same dict + a useT-equivalent for React Native; new GSD task should
  capture this (see Phase 9 candidate `t-mobile-i18n`, not yet specced).
- **Mapbox token unset in dev** — falls back to SVG schematic by design.
- **PostHog key unset in dev** — silent no-op by design.
- **In-memory rate limiter resets on cold-start** — acceptable for MVP
  launch; switch to Redis when traffic warrants (`t-rate-limit-redis`).
- **Seeded venues still have empty `photos`** — admins can now upload
  via the editor (Phase 11), but the 60 Rome venues from the seed CSVs
  haven't been backfilled yet. `t-real-photos` is still open and needs
  a human curation pass.

## Store release — remaining human steps

Code-side prep shipped in Phase 13. To actually appear in the stores
(see `mobile/STORE_SUBMISSION.md` for the full runbook):

1. Enroll: Apple Developer ($99/yr) + Google Play ($25) + free Expo account.
2. Deploy backend (Supabase + Render + Vercel — see DEPLOY.md), replace
   `REPLACE-WITH-YOUR-nocturna-api.onrender.com` in `mobile/eas.json` +
   fallback in `mobile/app.config.js`.
3. `eas init` → export EAS_PROJECT_ID → `eas build` → `eas submit` per platform.
4. Create + verify the `review@nocturna.app` demo account; capture screenshots.

## Available task IDs

From `ROADMAP.md` Phase 16:

- `t-streaming-chat` — stream AI concierge tokens
- `t-rate-limit-redis` — distributed rate limiter
- `t-real-photos` — curate real photos for the 60 Rome venues (needs
  human curation pass; upload tooling shipped in Phase 11)

## How to update this file

After every atomic commit, update:

1. **Last shipped** → new SHA + title + phase.
2. **In flight** → "None" if clean, else a one-line summary.
3. **Local environment health** → re-check counts if they changed.
4. Move newly-uncovered issues into "Open questions / known issues".
5. Remove any task ID from "Available" that you've started or finished.

GSD's `/gsd-resume-work` (when the plugin is installed) reads this file
to restore session context, so keep it accurate.
