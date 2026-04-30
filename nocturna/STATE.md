# Nocturna · State

> Live execution state. Update this file with **every** atomic commit.

## Branch

`claude/nocturna-night-planning-app-l6Rut`
(based on `main` from the SavoryMind monorepo)

## Last shipped

- **Commit:** `a322acf`
- **Title:** feat(nocturna): GSD t-i18n-complete — IT translations for remaining client surfaces
- **Phase:** 8 · GSD bootstrap + i18n completion

## In flight

None. Working tree clean. Spec-file SHA bookkeeping pending in this very commit.

## Local environment health

| Check | Status | Notes |
|---|---|---|
| `pytest tests` (backend) | **37 passed** | bcrypt 4.0.1 pinned; passlib pre-init |
| `tsc --noEmit` (frontend) | **clean** | |
| `next build` (frontend) | **clean** | 39 routes; sitemap + robots static; OG routes ƒ |
| `playwright test --list` | **3 specs** | Browser binary not installed in this sandbox |

## Production health

Untested in production. Cloud Build config (`cloudbuild.nocturna.yaml`)
parses cleanly but no deploy verified yet. Verify with:

```bash
gcloud builds submit --config=cloudbuild.nocturna.yaml \
  --substitutions=_REGION=europe-west1,_SECRET_KEY=$(openssl rand -hex 32),_APP_BASE_URL=https://placeholder.example
```

## Open questions / known issues

- **Mobile i18n** — Expo strings still English-only. Want to share the
  same dict + a useT-equivalent for React Native; new GSD task should
  capture this (see Phase 9 candidate `t-mobile-i18n`, not yet specced).
- **Mapbox token unset in dev** — falls back to SVG schematic by design.
- **PostHog key unset in dev** — silent no-op by design.
- **In-memory rate limiter resets on cold-start** — acceptable for MVP
  launch; switch to Redis when traffic warrants (`t-rate-limit-redis`).
- **Seeded venues have empty `photos`** — Trending cards show letter
  fallback. `t-real-photos` in ROADMAP addresses this.

## Available task IDs

From `ROADMAP.md` Phase 9:

- `t-photo-upload` — admin photo upload (Cloud Storage)
- `t-email-verify` — verification on signup
- `t-ics-attachment` — calendar invite on booking confirm
- `t-streaming-chat` — stream AI concierge tokens
- `t-rate-limit-redis` — distributed rate limiter
- `t-real-photos` — curate real photos for the 60 Rome venues (needs
  human curation pass)
- `t-cloud-scheduler-job` — provision reminder Scheduler in cloudbuild

## How to update this file

After every atomic commit, update:

1. **Last shipped** → new SHA + title + phase.
2. **In flight** → "None" if clean, else a one-line summary.
3. **Local environment health** → re-check counts if they changed.
4. Move newly-uncovered issues into "Open questions / known issues".
5. Remove any task ID from "Available" that you've started or finished.

GSD's `/gsd-resume-work` (when the plugin is installed) reads this file
to restore session context, so keep it accurate.
