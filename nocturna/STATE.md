# Nocturna · State

> Live execution state. Update this file with **every** atomic commit.

## Branch

`claude/nocturna-night-planning-app-l6Rut`
(based on `main` from the SavoryMind monorepo)

## Last shipped

- **Commit:** `7ba9b1c`
- **Title:** feat(nocturna): GSD t-email-verify — email verification on signup
- **Phase:** 12 · Auth hardening

## In flight

None. Working tree clean.

## Local environment health

| Check | Status | Notes |
|---|---|---|
| `pytest tests` (backend) | **68 passed** | bcrypt 4.0.1 pinned; +11 new in test_email_verify.py |
| `tsc --noEmit` (frontend) | **clean** | |
| `next build` (frontend) | **clean** | 40 routes; new /verify/[token] ƒ; sitemap + robots static |
| `playwright test --list` | **3 specs** | Browser binary not installed in this sandbox |

## Production health

Untested in production. Cloud Build config (`cloudbuild.nocturna.yaml`)
now has 10 steps and parses cleanly. The new `provision-scheduler` step
auto-creates the reminder Cloud Scheduler job when `_CRON_TOKEN` is set.
Verify a deploy with:

```bash
gcloud builds submit --config=cloudbuild.nocturna.yaml \
  --substitutions=\
_REGION=europe-west1,\
_SECRET_KEY=$(openssl rand -hex 32),\
_CRON_TOKEN=$(openssl rand -hex 24),\
_APP_BASE_URL=https://placeholder.example
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

## Available task IDs

From `ROADMAP.md` Phase 13:

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
