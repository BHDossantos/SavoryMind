# Nocturna e2e tests

Playwright drives the full stack: it starts the FastAPI backend (SQLite, seeded)
and the Next.js dev server, then exercises the user golden path end-to-end.

## Run

```bash
# Install browsers once (real browsers, not the chrome you have)
npx playwright install chromium

# From nocturna/frontend:
npm run e2e          # headless
npm run e2e:ui       # interactive UI mode
```

On CI images with a pre-installed Playwright Chromium whose build doesn't
match this @playwright/test version, point at the headless shell binary:

```bash
CI=1 CHROMIUM_BIN=/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell \
  npx playwright test
```

(Newer full-Chromium builds removed `--headless=old`, which this Playwright
version passes — the standalone headless shell still accepts it.)

`playwright.config.ts` boots both servers via `webServer`; on a workstation
they stay up across runs. In CI, set `CI=1` so Playwright spawns fresh ones
and tears them down.

## What's covered

- **Home → planner quiz → results page**: every default step accepted, asserts
  at least one plan card renders.
- **Book this plan**: fills the contact form, submits, asserts the multi-stop
  status board renders with at least one stop.
- **Admin verification**: logs into the admin API directly, asserts the
  booking landed in `/api/admin/bookings?status=new`.
- **Venue detail**: loads a real seeded venue slug and checks the map +
  booking CTA render.
- **Admin login**: signs in with the bootstrap admin and confirms the
  dashboard renders.

The bootstrap admin (`admin@nocturna.app` / `ChangeMe123!`) is created on
first backend boot via `seed.bootstrap_admin`.
