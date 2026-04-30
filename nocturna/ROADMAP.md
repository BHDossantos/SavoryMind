# Nocturna · Roadmap

Phased plan with XML task blocks for the GSD execute loop. Shipped phases
live here as the historical record; **open** phases drive future work.

## Phase 1 · MVP scaffold [shipped — `fcbbe1b`]
Backend (FastAPI + Postgres) with all 16 models + recommender + 12 route
groups + 89 seeded venues. Web (Next.js 14) + mobile (Expo Router) +
admin + partner dashboards. Docker Compose + Cloud Run skeleton.

## Phase 2 · Boot fixes [shipped — `e1b00f4`]
bcrypt 4.0.1 pin (passlib self-test). `is_open_at` overnight wrap.
Club-hour rule narrowed to daytime. Slot-type fallback for sparse cities.
Plan-combination dedupe.

## Phase 3 · Real data + multi-stop [shipped — `20c51fe`, `6031e3f`]
60 real Rome venues across 4 CSVs + idempotent importer with diff preview.
Multi-stop "Book this plan" (web + mobile + status board). Mapbox map
component + Near Me geo CTA + GET /api/venues/near.

## Phase 4 · Payments + notifications + deploy [shipped — `2087b2d`]
Stripe webhook hardening (signature, idempotency, 9 event types).
Receipt emails. Templated booking lifecycle (received / confirmed /
rejected / cancelled). Admin notifications page (provider status, send
test, delivery log). `cloudbuild.nocturna.yaml` deploys nocturna-api +
nocturna-web. `Dockerfile.prod`. DEPLOY.md.

## Phase 5 · Quality + i18n + analytics [shipped — `d1b51ba`]
Playwright e2e (3 specs, both servers via webServer). Italian dictionary
+ locale switcher + cookie persistence. PostHog frontend events + server
mirror.

## Phase 6 · Distribution [shipped — `6b0a129`, `9a24b42`]
Server-rendered metadata for venue + share. JSON-LD per venue type.
sitemap.ts + robots.ts. Manifest + install prompt + PWA icons. Venue
photo gallery + card photos.

## Phase 7 · Operations [shipped — `ff6a5d7`, `4668ad1`, `2a7727c`]
Booking reminder cron (T-60min, idempotent). Branded OG image generators
(`/og/plan/[token]`, `/og/venue/[slug]`). Italian polish for booking +
feedback + auth. Admin bookings UX overhaul. Guest rate limiter. CSV
exports (bookings / payments / commissions). Saved venues / favourites.

## Phase 8 · GSD bootstrap + i18n completion [shipped — `a685022`, `a322acf`]

- `a685022` — adopt GSD methodology: `PROJECT.md`, `REQUIREMENTS.md`,
  `ROADMAP.md`, `STATE.md` bootstrap.
- `a322acf` — task **`t-i18n-complete`** shipped: useT() wired into
  bookings detail, chat, groups (new + token), my-plans, profile,
  premium. ~50 new dictionary keys (mybook / chat / group / myplans /
  profile / premium / common.*) added in EN + IT.

## Phase 9 · Open

Open work captured as XML task blocks. Pick the highest-leverage one
(or any), execute it, verify, atomic commit, then mark **[shipped]** and
update `STATE.md`.

```xml
<task id="t-photo-upload" type="auto">
  <name>Real photo upload pipeline (admin)</name>
  <files>
    backend/app/api/routes/admin_uploads.py (new)
    backend/app/services/storage.py (new)
    frontend/src/app/admin/venues/page.tsx
  </files>
  <action>
    Backend: storage.py abstracts a pluggable backend — local disk under
    /uploads in dev, Google Cloud Storage in prod (selected via env).
    Returns signed URLs. New POST /api/admin/venues/{id}/photos accepts
    multipart upload (images only, ≤5 MB), saves, appends URL to
    venue.photos. New DELETE removes by URL.
    Frontend: in the venue editor, replace the "photos (comma-sep)"
    textarea with a drop-zone uploader showing thumbnails with X-to-delete.
  </action>
  <verify>
    pytest covers: storage local backend round-trip, photos array append
    is unique, oversize/wrong-mime rejected. tsc + next build clean.
    Manual: drop 3 images on a venue, see them on /venues/{slug}, OG
    image at /og/venue/{slug} now uses the first one.
  </verify>
  <done>
    Admin can upload + delete photos without hand-typing URLs; venue
    detail + OG image consume them.
  </done>
</task>

<task id="t-email-verify" type="auto">
  <name>Email verification on signup</name>
  <files>
    backend/app/models/user.py
    backend/app/api/routes/auth.py
    backend/app/services/templates.py
    frontend/src/app/verify/[token]/page.tsx (new)
  </files>
  <action>
    Add User.email_verified bool + email_verify_token. On signup, generate
    token + send templated email with link to /verify/{token}. On verify,
    flip the flag + clear the token. Block /api/admin and partner endpoints
    when role>user and not verified. Show banner on /me/* until verified.
  </action>
  <verify>
    pytest: signup leaves email_verified=False; /verify/{token} flips it;
    expired/invalid token returns 400; admin endpoints reject unverified.
    Manual: signup → check console-fallback email log → click link → flag
    flips.
  </verify>
  <done>
    No production accounts go live without a verified email; admin/partner
    role acquisition gated behind verification.
  </done>
</task>

<task id="t-ics-attachment" type="auto">
  <name>ICS calendar attachment on booking confirmation</name>
  <files>
    backend/app/services/templates.py
    backend/app/services/notifications.py
    backend/app/services/calendar.py (new)
  </files>
  <action>
    calendar.py builds an .ics VEVENT for a booking (DTSTART from date+time,
    SUMMARY = "Nocturna · {venue}", LOCATION, DESCRIPTION includes plan
    label + dress code). On status-change to confirmed, attach to the
    SendGrid email payload. SMS body unchanged.
  </action>
  <verify>
    pytest validates the .ics output parses as valid VCALENDAR; existing
    notifications tests remain green. Manual: confirm a booking, open
    the email in Apple Mail / Gmail, "Add to Calendar" works.
  </verify>
  <done>
    User-facing booking confirmation emails carry an .ics file users can
    add with one tap.
  </done>
</task>

<task id="t-streaming-chat" type="auto">
  <name>Streaming AI concierge chat</name>
  <files>
    backend/app/api/routes/chat.py
    backend/app/services/ai_chat.py
    frontend/src/app/chat/page.tsx
  </files>
  <action>
    Switch /api/chat/send to a streaming endpoint using FastAPI
    StreamingResponse and Anthropic's messages.stream. Frontend uses
    fetch + ReadableStream to render tokens incrementally. Tool-call
    payload (generate_plan output) still flushes at end.
  </action>
  <verify>
    pytest: non-streaming path still works in the deterministic-fallback
    branch (when no API key). Manual: open /chat, send a message, see
    tokens render character-by-character; tool-use plan still resolves.
  </verify>
  <done>
    Concierge feels real-time; perceived latency drops below 1s for
    first-token.
  </done>
</task>

<task id="t-rate-limit-redis" type="auto">
  <name>Redis-backed rate limiter</name>
  <files>
    backend/app/services/rate_limit.py
    backend/requirements.txt
    cloudbuild.nocturna.yaml
  </files>
  <action>
    Extend RateLimiter with a RedisBackend; select via NOCTURNA_REDIS_URL
    env var, fall back to in-memory when unset. Same take()/reset() API.
    Add Memorystore provisioning to deploy doc.
  </action>
  <verify>
    Existing 4 rate-limit tests still pass against in-memory. Add 2 tests
    that monkeypatch the Redis backend with fakeredis. Manual: set
    NOCTURNA_REDIS_URL, hammer /api/planner/generate from two browser
    tabs, confirm the limit holds across both.
  </verify>
  <done>
    Limits survive cold-starts and scale across multiple Cloud Run
    instances.
  </done>
</task>

<task id="t-real-photos" type="auto">
  <name>Real photo curation for the 60 Rome venues</name>
  <files>
    backend/app/seed/data/rome_venues_real*.csv
  </files>
  <action>
    For each of the 60 seeded Rome venues, locate 1–3 publicly-shareable
    photos (venue's own media kit / Wikimedia Commons / Unsplash with
    attribution). Update the photos column in each CSV (pipe-separated
    URLs). Re-run the importer to upsert.
  </action>
  <verify>
    pytest still green (importer round-trip). Trending cards on the home
    show real images. /og/venue/{slug} unfurls a real photo on WhatsApp.
  </verify>
  <done>
    No more letter-fallback placeholders on Rome venue cards; OG images
    look like a real listing.
  </done>
</task>

<task id="t-cloud-scheduler-job" type="auto">
  <name>Provision Cloud Scheduler job for reminders in cloudbuild</name>
  <files>
    cloudbuild.nocturna.yaml
  </files>
  <action>
    Add a step at the end of cloudbuild.nocturna.yaml that idempotently
    creates a Cloud Scheduler job named nocturna-reminders running every
    15 minutes, hitting the deployed API URL with X-Cron-Token. Use
    `gcloud scheduler jobs describe ... || gcloud scheduler jobs create ...`
    so re-runs don't fail.
  </action>
  <verify>
    Build runs to completion (validate yaml structure). Manual: trigger a
    deploy with _CRON_TOKEN set, confirm the scheduler job appears in
    Console.
  </verify>
  <done>
    Reminders run automatically on every deploy without a manual gcloud
    step.
  </done>
</task>
```

## Phase 9 · Beyond MVP (sketches, not yet specced)

- Real-time booking status push (WebSocket / Server-Sent Events) so the
  status board updates without manual refresh.
- Concierge inbox: incoming WhatsApp messages from venues mapped back to
  bookings.
- Group chat inside a GroupPlan (not just voting).
- Personalized memory across sessions (PostHog → user.prefs sync).
- Multi-language venue descriptions (per-locale `description` column).
- Mobile push-notification deep links into specific plans / bookings.
- Subscriptions for venue partners with auto-billing rollups.

These intentionally have **no** XML blocks yet — they're inputs for future
discuss-phase.

## How to use this file (GSD execute loop)

1. Pick a task from "Phase 8 · Open".
2. Read its `<files>`, `<action>`, `<verify>`, `<done>`.
3. Make the change. Run the `<verify>` steps.
4. Atomic commit (one task = one commit). Push.
5. Move the block from "Phase 8 · Open" to a new dated phase below
   marked **[shipped]** with the commit SHA.
6. Update `STATE.md` (`Last shipped`, `In flight`, `Test counts`).
