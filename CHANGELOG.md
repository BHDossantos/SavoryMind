# Changelog

Project-level changelog. Reverse-chronological. New entries go at the top.

## Unreleased — Phases 1 & 2 + App Store readiness

Three independent PRs that together close out the post-PR-#18 milestone (`/gsd-new-project`-bootstrapped roadmap with Phase 1 = inventory tracking, Phase 2 = mobile consumer parity backport) and unblock first-ever App Store / Play Store submission.

Branches: `feat/phase-1-inventory` (PR #20), `feat/app-store-readiness` (PR #21), `feat/phase-2-mobile-consumer-parity` (PR #22). All three squash-on-merge. They touch different files; merge order doesn't matter.

### Phase 1 — Restaurant inventory tracking (PR #20, +30 tests)

- New SQLAlchemy models `InventoryItem` + `InventoryAdjustment` (Alembic migration `8c1f5b3e2a47`). Append-only ledger; `current_quantity` is computed from the ledger sum at read time, never stored — makes the table a real audit trail rather than a state cache.
- `users.timezone` column (IANA name, default `'UTC'`) so the weekly digest can fire Monday 8am restaurant-local.
- 6 endpoints under `/api/inventory/*` (list / create / patch / archive / adjust / categorize) — all rate-limited via slowapi, restaurant-only via `require_restaurant` gate.
- Tenancy isolation enforced at the service layer; cross-tenant lookups return 404 (not 403) to avoid leaking item existence (THREAT-MODEL T1).
- No PATCH/DELETE on adjustments — to "fix" a bad adjustment, log a `count_correction` row (T2).
- Soft-delete via `archived_at` sentinel; archived items hidden from list but historical adjustments stay queryable.
- Claude auto-categorize endpoint (`POST /api/inventory/categorize`) — Haiku model with rules-based fallback to `food/0.0` when Anthropic key unset OR Claude returns out-of-enum garbage (T5 prompt-injection mitigation).
- Weekly digest job: hourly Cloud Scheduler trigger + per-restaurant timezone filter selects restaurants currently at Mon 8am local. Idempotent within an ISO week — re-runs `UPDATE` the existing `Notification` row rather than inserting duplicates (T6 spam mitigation).
- New `inventory_digest_service` + `resend_client` (mirrors `claude_client` shape — no-op when `RESEND_API_KEY` unset, sanitized exception logs).
- New `/internal/jobs/inventory-digest` endpoint authenticated via Google OIDC token (verified issuer / audience / scheduler service-account email); refuses to run when env unset (T3 mitigation).
- Web inventory page (`frontend/src/pages/restaurant/inventory.js`) — Tailwind table with category filter pills, low-stock-first sort, add-item modal with categorize-on-blur, adjust modal, soft-archive flow.
- Mobile inventory screen (`mobile/app/(restaurant)/inventory.js`) with counting-optimized bottom sheet: large +/- and case-pack buttons (case size derives from `unit` via `mobile/utils/casePacks.js`), expo-haptics on tap, live delta projection ("4 → 16"). Designed for cold fingers in a walk-in cooler.
- Nav entries on both web (Layout.js between Food Waste and Kitchen Times) and mobile (`(restaurant)/_layout.js` hidden tab + entry on More screen).
- Tests: +18 backend (auth scoping, tenancy, ledger immutability, current_quantity derivation, categorize fallback) + +12 backend (digest behavior, OIDC auth gate, RESEND conditional) + +5 web + +5 mobile.
- Total: +30 tests; suite goes 79 → 109 backend, 33 → 38 web, 53 → 58 mobile.

**Operator-side actions post-merge** (in `SUBMISSION-CHECKLIST.md` and PR #20 body):
1. Create scheduler service account + IAM grant
2. Set `SCHEDULER_SERVICE_ACCOUNT` + `SCHEDULER_AUDIENCE` env vars on backend Cloud Run
3. Create the Cloud Scheduler job (hourly Mon UTC, OIDC token to `/internal/jobs/inventory-digest`)
4. Trigger once via `gcloud scheduler jobs run` to verify

### Phase 2 — Mobile consumer parity backport (PR #22, +16 tests)

Closes the 3 mobile parity gaps the post-PR-#18 audit surfaced. PAR-03 ("beverages broken") was the most interesting — existing `pairings.js` had Wine/Beer/Spirits tabs but read STALE field names (`wine_recommendation`, `beer_style`, `spirit_recommendation`) that don't exist in the current backend response shape. Beer + spirits were silently empty even when the backend returned data — worse failure mode than "missing entirely" because there was no error or empty state.

- **PAR-01:** new `mobile/app/(consumer)/order.js` — 4-step delivery wizard (Craving → Dish → Restaurant → Order). Mock fulfillment matches web behavior; real ordering integration is a separate phase.
- **PAR-02:** new `mobile/app/(consumer)/guided-cooking.js` — step-by-step recipe walkthrough with per-step timer (1/2/3/5/10/15 min presets, Pause/Resume/Reset, color shifts at 10s warning), inline Culinary Assistant (collapses to "Something went wrong?" CTA, expands to free-text `askAssistant` query), done-state memory modal that captures rating + notes + change-next-time and writes to the food journal via `createMemory`.
- **PAR-03:** rewrote `mobile/app/(consumer)/pairings.js` to consume the actual backend response shapes — `recommendations: [...]` for wine via `createWinePairing`, `pairings: [...]` for beer + spirits via `getBeerPairing` / `getSpiritsPairing`. Confidence bars with 3-tier color (green ≥80%, amber ≥60%, gray below). Top match (index 0) gets a highlighted border. Wine endpoint correctly sends `dish_name` (was sending `dish` which the backend ignored → silent failure).
- Recipe detail modal gets a "👨‍🍳 Start guided cooking" button that pushes to the new screen with `?id=<recipe_id>`.
- Dashboard QUICK grid gets a `🛵 Order` tile (now 7 entries instead of 6).
- 3 hidden-tab entries added in `(consumer)/_layout.js` (`order`, `guided-cooking` are reachable via `router.push` from dashboard / recipes).
- Tests: +6 pairings (wine/beer/spirits API shapes, top-match highlighting, empty-input no-call), +6 order (initial render, craving-fetch, dish-fetch, full happy-path through 4 steps to success), +5 guided-cooking (recipe load, step traversal, memory modal save, inline assistant, recipe-not-found).
- Total: +16 mobile tests; mobile suite goes 53 → 69.

### App Store readiness (PR #21, +9 tests)

Closes the two highest-priority blockers for first iOS submission:

- **Sign in with Apple** — App Store Review Guideline 4.8 requires this when offering Google sign-in (which we do). Without it every iOS submission gets rejected. Implementation mirrors `google_oauth.py`:
  - `apple_oauth.py` — verifies Apple-issued ID tokens against Apple's JWKS (`https://appleid.apple.com/auth/keys`), validates issuer + audience (= `apple_bundle_id` env var, `net.savorymind.app`) + expiration. Apple's email_verified can be string or bool — normalized. Apple's "Hide my email" forwarding addresses (`xxx@privaterelay.appleid.com`) accepted as real verified emails.
  - `POST /api/auth/apple` — accepts `{id_token, name?, email?}`. Critical: id_token NEVER includes `name` (and may omit `email` if user revoked email sharing) — those come from the mobile client's `response.fullName` / `response.email` on FIRST sign-in only. Backend persists them on the new user row; subsequent sign-ins return only `sub` and the backend uses existing user data unchanged. Apple's privacy design.
  - `apple_bundle_id` env var added to settings; defaults to `""` (returns 503 cleanly when unset, same dormant pattern as Google).
  - Mobile: `expo-apple-authentication ~55.0.7` added to package.json + plugin entry + `ios.usesAppleSignIn: true` in `app.json`. `appleLogin({idToken, name, email})` added to `services/api.js`. `loginApple` added to `AuthContext`. The login screen's existing Apple tile (was routing to WebBrowser fallback) now triggers `signInAsync` on iOS; `ERR_CANCELED` is silent dismissal.
- **Privacy Policy + Terms of Service** — both stores require publicly hostable URLs at submission time. New pages at `frontend/src/pages/legal/privacy.js` and `/legal/terms.js`. Honest disclosure of data collection (account / auth / connected Spotify / user content / Sentry), third-party sharing (Anthropic / Spotify / Google / Apple / Resend / Sentry / GCP), retention, user rights (GDPR + CCPA). Email contact `privacy@savorymind.net` for data requests; `hello@savorymind.net` for terms questions.
- Tests: +7 backend (Apple endpoint: 503 unconfigured / 400 missing token / 401 invalid token / first sign-in with body name+email / subsequent sign-in / email omitted entirely / links to existing email account) + +2 mobile (Apple tile triggers signInAsync + forwards token correctly; user cancellation is silent).
- Total: +9 tests; backend goes 79 → 86, mobile 53 → 55. Web tests unchanged (legal pages are pure markup).

**Operator-side actions post-merge** (in `SUBMISSION-CHECKLIST.md` and PR #21 body):
1. Apple Developer Program enrollment ($99/year)
2. Bundle ID + Sign in with Apple capability at developer.apple.com
3. Set `APPLE_BUNDLE_ID = "net.savorymind.app"` in GitHub Actions secrets + add to deploy workflow `--set-env-vars`
4. Verify privacy policy reachable at `savorymind.net/legal/privacy` after frontend deploy
5. App icon (1024×1024) + adaptive icon for Android — replace the placeholder
6. Demo accounts for App Review (`appreview-consumer` + `appreview-restaurant`)

### Documentation

- `SUBMISSION-METADATA.md` (root) — copy-paste-ready strings for every App Store Connect + Play Console field (description, keywords, what's-new, privacy nutrition labels, data safety form, screenshot lineup with captions). Cross-referenced against the privacy policy so disclosures stay truthful.
- `SUBMISSION-CHECKLIST.md` (root) — single source of truth for every operator-side action across PRs #20 / #21 / #22 plus the App Store / Play Store submission flow itself. Replaces "go grep across 3 PR bodies + DEPLOYMENT.md."
- This CHANGELOG entry.

### Known caveats

- **No real-device mobile testing** in the dev sandbox. All 3 mobile-touching PRs need a phone in your hands. Reanimated 3→4 worklet behavior + expo-haptics + the new bottom-sheet UX all need real-touch validation.
- **PR #21 had a CI flake** on first push — `expo-apple-authentication` was pinned `~8.0.7` (wrong version line; SDK 55-compatible is `~55.0.7`) AND the lockfile wasn't regenerated. Fix `bbcb3ec` corrects both. Future Expo dep additions: always run `npm install` to regenerate the lockfile or CI's `npm ci --ignore-scripts` will fail before tests run.
- **Reports CSV export** mentioned in PLAN-3 was deferred — current `reports.py` returns structured JSON, not CSV. A bulk inventory export is a separate phase; data already accessible via `/api/inventory`.
- **Apple Sign-In on Android** not wired — currently falls through to WebBrowser fallback. Apple sign-in via JS on Android adds setup complexity for limited value (Android users typically use Google or email/password). Punt until usage data shows it matters.

### Test totals

| Suite | Pre-Phase-1-2 | Post-Phase-1-2 | Delta |
|---|---|---|---|
| Backend pytest | 79 | 116 (109 + 7 Apple) | +37 |
| Frontend Jest | 33 | 38 | +5 |
| Mobile Jest | 53 | 76 (58 + 2 Apple + 16 parity) | +23 |
| **Total** | **165** | **230** | **+65** |

(Numbers will vary slightly depending on merge order; assuming all three PRs merge cleanly the final test count is 230.)

---

## Released — PR #18 (merged as `70ace80` on 2026-05-07)

A 38-commit consolidation that started as three security audit fixes and grew into

A 38-commit consolidation that started as three security audit fixes and grew into
a full security + AI + multi-platform overhaul + mobile/web parity sweep + native
Google sign-in. Branch `claude/fix-screenshot-api-error-8JNoK`. **Squash on merge**
is the right strategy — the per-commit history is useful for bisecting if something
regresses, but `main` doesn't need 33 entries.

### Activation prerequisites — add these to repo Actions secrets *before* merging

The deploy workflow expects them. The lifespan refuses to start in production if
any are missing, so the deploy will fail fast rather than silently:

- `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` — register an app at
  developer.spotify.com, set redirect URI to
  `https://api.savorymind.net/api/oauth/spotify/callback`. Without these, the
  `/api/oauth/spotify/*` endpoints return 503 (UI degrades cleanly).
- `TOKEN_ENCRYPTION_KEY` — generate with
  `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
  **Required for prod startup** — lifespan refuses to boot if it's missing or matches
  the dev default.
- `ANTHROPIC_API_KEY` — already set in the existing deploy from the assistant feature,
  so the new AI endpoints (recommendations, trends, marketing, training, review themes)
  light up automatically.
- `GOOGLE_CLIENT_ID` (optional) — register an OAuth client at console.cloud.google.com
  → APIs & Services → Credentials, set this to its Client ID. Without it, the new
  `/api/auth/google` endpoint returns 503 cleanly and mobile's Google tile falls
  through to the WebBrowser fallback. The mobile app needs the *same* Client ID set
  as `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (audience claim must match between device and
  server).

### Security

- **Block account_type self-promotion** (CRITICAL). `PATCH /api/auth/profile` previously
  let a logged-in consumer/diner promote themselves to `restaurant` and gain access to
  restaurant-only routes. `account_type` is now set-once with a defense-in-depth allowlist
  against `ProfileUpdate.model_fields`.
- **Refresh-token architecture**. Replaced 30-day localStorage JWT (XSS-stealable) with
  30-min in-memory access token + 30-day httpOnly Secure SameSite=Lax refresh cookie
  scoped to `.savorymind.net`. Mobile uses an analogous `X-Refresh-Token` header path.
  JWTs carry a `typ` claim to prevent cross-token-type misuse.
- **JTI revocation**. `/auth/logout` blacklists the cookie's JTI in a new
  `refresh_token_revocations` table. `/auth/refresh` rejects revoked JTIs and *also*
  revokes the old JTI on rotation (replay detection — stolen-then-rotated cookies stop
  working).
- **OAuth tokens encrypted at rest**. SocialConnection's `access_token` and
  `refresh_token` columns now use a Fernet-backed SQLAlchemy `TypeDecorator`. On-disk
  inspection shows `gAAAAA…` ciphertext, zero plaintext. Tampered ciphertext + legacy
  plaintext both decode to None gracefully.
- **CSP / cookie attributes**. `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAMESITE` env-driven,
  with safe defaults for prod and overrides for local dev.
- **Cloud Run hardening**. `--memory 1Gi --cpu 1 --min-instances 1` so cold starts don't
  cause cascading 503s.
- **CORS regex narrowed** from `https://[a-z0-9-]+\.a\.run\.app$` (any Cloud Run URL on GCP!)
  to `https://savorymind-[a-z0-9-]+\.a\.run\.app$`.
- **`/health` no longer leaks** raw DB exception strings to anonymous clients.
- **avatar_url validator** — HTTPS-only, rejects `javascript:` / `data:` schemes.
- **Loud frontend domain mapping** — replaced the `2>/dev/null || echo "..."` pattern in
  the frontend deploy with describe-first probing; CI now fails loudly if `savorymind.net`
  points to the wrong service.
- **CVE patches** (12): `next` 14.2.35 → ^15.5.15 (5 CVEs), `postcss` 8.4.38 → ^8.5.10 (1),
  `fastapi` 0.111.0 → 0.136.1 + transitive starlette CVEs, `python-multipart` 0.0.9 → 0.0.27
  (DoS), `python-dotenv` 1.0.1 → 1.2.2, plus `pydantic`, `sqlalchemy`, `uvicorn`, `httpx`,
  `sentry-sdk`, `aiosqlite`, `greenlet`, `hashicorp/setup-terraform` v1 → v3.

### AI / personalisation

The codebase used to call its `app/ml/` folder "ML" but it was weighted scoring + frequency
analysis (the docstring even admitted it). PR #18 replaces the rule-based templating with
real LLM calls (Claude Opus 4.7 / Haiku 4.5 via Anthropic SDK) for every consumer-facing
"insight" feature, and renames the folder honestly.

- **Shared `claude_client`**. Single `is_configured()` / `call_json(system, payload, schema)`
  entry point that handles SDK setup, prompt caching (`cache_control: ephemeral`), JSON
  schema output, refusal detection, and timeout/error handling. Returns None on any failure
  so callers always have a graceful fallback.
- **Consumer + diner recommendations** (`/api/consumer/recommendations`,
  `/api/diner/recommendations`). Same profile + behavior + history that fed the rules
  engine now goes to Claude with a JSON-schema response. The original rules engine is
  preserved as `_build_*_rules` and runs as fallback when the API key is unset or the call
  fails. Zero regression for key-less deploys.
- **Spotify listening signal** feeds the consumer recommendation prompt. New
  `spotify_service.get_listening_signal()` fetches the user's top artists / genres / tracks
  via `/v1/me/top/artists` + `/v1/me/top/tracks` (requires `user-top-read` scope), passes
  to Claude as `spotify_listening` field. Recommendations now reference real listening
  taste ("Your heavy Bad Bunny rotation pairs well with Spanish reds — try this Rioja").
  Falls back silently when Spotify isn't connected or the user hasn't granted the new
  scope.
- **Restaurant trends + marketing + training** (`/api/restaurant/trends`,
  `/api/restaurant/marketing`, `/api/owner/training`). The data-driven aggregations
  (rising stars, retention rate, per-staff waste profiles) are unchanged — those are real
  metrics. The hard-coded `global_trends`, `tips`, threshold-based `actions`, and
  templated training plans are now Claude-generated with the actual numbers as input.
  Rules-based version preserved as fallback.
- **Review theme extraction**. VADER (sub-millisecond polarity scoring) still runs on
  every review save. Stage 2 — Claude (Haiku-4.5 for cheaper batch work) extracts
  `themes`, `complaints`, `praise`, and `tone` per review. Best-effort: a Claude failure
  saves the review with VADER-only data and null theme columns.
- **New `/api/reviews/themes` endpoint** aggregates theme/complaint/praise counters
  across all of a restaurant's reviews. Surfaces a "What guests are talking about" panel
  on both web and mobile sentiment dashboards — turns "47 positive, 12 negative" into
  "12 of your reviews mention 'wait time'".
- **Drive-by fix during the marketing refactor**: the original code imported
  `RestaurantBooking` which doesn't exist in `models.restaurant_ext` (the model is
  `Booking`). The marketing endpoint would have crashed on first call with real data.
- **`app/ml/` → `app/insights/`** because there's no machine learning in there. Real ML
  was considered (Prophet for sales forecasting, embedding-based recs) and rejected for
  per-restaurant / per-user dataset sizes — LLM coverage outperforms what classical
  models could learn. Folder rename is just honesty.

### Spotify integration

What used to be a UI-only stub (the "Connect" button stored a typed username with no
OAuth handshake) is now a real Authorization Code flow with playable tracks.

- **Real OAuth at `/api/oauth/spotify/{start,callback,disconnect,search}`**. State
  parameter is an HS256-signed JWT (10-min TTL, `typ=spotify_oauth_state`) carrying the
  user_id — protects against the cross-user CSRF attack on OAuth callbacks.
- **`get_fresh_access_token()` wrapper** auto-refreshes within 60s of expiry.
  Spotify-rejected refresh tokens (revoked from spotify.com/account/apps) mark the
  connection disconnected and the UI prompts a reconnect.
- **Real track search** on the Music Mood page. Web + mobile both call `/v1/search` with
  the user's token and render real tracks (album art, name, artists, "Open ↗" link)
  instead of a static `https://open.spotify.com/search/...` URL.
- **`user-top-read` scope** added in the listening-signal commit. Existing connections
  still work on the legacy scope; the connection card carries a "Reconnect for richer
  recommendations" amber banner when the new scope is missing — opt-in upgrade.
- **The four non-Spotify platforms** (Amazon Music, Alexa, Instagram, TikTok) were
  removed entirely. Amazon Music has no public OAuth; Alexa needs an Alexa Skill;
  Instagram and TikTok need Meta Business / TikTok app review. Marking them "Demo" was a
  half-measure; removing them is honest.

### Mobile

- **Refresh-token alignment with backend**. `X-Client-Type: mobile` header asks the
  backend to surface `refresh_token` in the response body (web continues to use the
  cookie). Tokens stored in `expo-secure-store` (OS-keychain-backed). 401 → `/auth/refresh`
  with `X-Refresh-Token` header → retry, with concurrent-request coalescing.
- **Culinary Assistant screen** (Claude Opus 4.7). Chat UI with FlatList, multi-line
  input, suggestion chips, animated typing indicator, in-line error fallback. Featured
  card on the consumer dashboard.
- **Dropped the broken native Google flow** (`loginSocial` was shipping
  `SOCIAL_LOGIN_SECRET` in the bundle). All social providers now route through the web
  app via `WebBrowser`. Native Google sign-in is a deferred follow-up (needs a backend
  Google ID-token verifier).
- **Spotify connect screen + real track search** ported from web. Hidden tab via
  `href: null` on the Tabs layout, reachable from profile.
- **Themes panel** on the restaurant sentiment dashboard.
- **SDK 54 → 55 alignment**. The mobile package.json was pinned to versions that no
  longer existed on npm (`expo-haptics@~14.2.0` was canary-only). Aligned every dep with
  Expo SDK 55's bundled native modules manifest. `npm install` now resolves cleanly.
- **Parity sweep — 5 new screens** closing the bulk of the mobile-vs-web gap (see commit
  baf4c1d):
  - **Pantry** (consumer): ingredient inventory grouped by category, "what can I make?"
    recipe matcher via `/api/consumer/pantry/recipes`, optimistic delete with rollback.
  - **Journal** (consumer): mood-tagged meal memories. Inline form, soft-delete with
    confirm.
  - **Notifications** (top-level): bell with unread badge on the consumer dashboard,
    list screen at `/notifications`, marks read on visit (best-effort).
  - **Employees** (restaurant): staff portal account management with role chips. Surfaces
    from the More tab.
  - **Restaurant detail** (diner): full booking flow at `(diner)/restaurant/[id]`.
    Date-aware availability, party-size selector, tap a slot → `/api/discover/book`.
- **API method parity**: 25 missing methods added to `mobile/services/api.js` covering
  pantry, journal, notifications, delivery, restaurant booking actions, restaurant
  availability, diner discovery + booking, diner reviews.
- **Deliberate platform difference (NOT a gap)**: web has separate `wine.js` +
  `beverages.js` routes; mobile keeps the existing `pairings.js` (single tabbed screen).
  Single-screen-with-segmented-tabs is better mobile UX than three routes; documented
  here so the next audit doesn't flag it as missing parity.
- **Deferred consumer pages** (intentional, not blocking parity): `cook.js` (timer-only,
  low value before voice/locale work lands), `guided-cooking.js` (385 LOC requires real
  product investment, not parity port), `explore.js` (overlaps existing dashboard
  recommendations), `order.js` (delivery API on backend is hard-coded suggestions, not
  real ordering), `welcome.js` (mobile lands on dashboard directly).

### Native Google sign-in

Closes the only remaining auth gap from the original audit. Replaces the
SOCIAL_LOGIN_SECRET shared-secret pattern (fine when only Next.js holds the secret,
dangerous if it ever ships to a client) with a backend that cryptographically verifies
Google-issued ID tokens.

- **New endpoint `POST /api/auth/google`**. Accepts `{id_token}`, fetches Google's JWKS
  (cached 5 min), looks up the signing key by `kid`, verifies the RS256 signature,
  validates `iss` (must be `accounts.google.com` in either form), `aud` (must equal
  `GOOGLE_CLIENT_ID`), `exp`, and `sub` presence. All failures map to a single opaque
  401 — specific reason logged but never surfaced to the client.
- **Unverified-email safety net**. When Google issues a token with `email_verified=false`
  (sometimes happens for OIDC flows from Workspace tenants), the verifier zeros out the
  `email` claim. `social_login()` then creates a brand-new user with the Google `sub` as
  the unique key instead of accidentally linking to an existing SavoryMind account that
  uses the same address.
- **Mobile UI wired**. `app/login.js` and `app/signup.js` use
  `expo-auth-session/providers/google` when `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set —
  native sheet, no shared secret on the device. When the env var is unset, the Google
  tile falls through to the existing WebBrowser-to-web-app path. The
  `WebBrowser.maybeCompleteAuthSession()` gate handles the redirect.
- **Bug caught while wiring**: both web and mobile `isAuthEndpoint` guards in `api.js`
  were missing `/api/auth/google` (and mobile was missing `/api/auth/social` too).
  Without the guard, a 401 from the verifier triggered the auto-refresh-retry path and
  surfaced "Session expired" instead of the real error. Fixed pre-emptively on both
  clients.
- **Dependencies**: `pyjwt[crypto]==2.12.1` on backend (the `[crypto]` extra pulls in
  the `cryptography` lib already used by Fernet — no new transitive deps).

What this does NOT replace: `/api/auth/social` (still used by the web NextAuth bridge,
where the secret never leaves the Next.js server). Both endpoints can issue sessions;
they just verify identity differently.

### Schema migrations (Alembic)

Three additive migrations, all safe-to-rerun:

- `4490178aadd3` — Spotify OAuth token columns on `social_connections`
  (access_token, refresh_token, token_expires_at, scopes, provider_user_id).
- `2d78950e0987` — `refresh_token_revocations` table (jti PK, expires_at, user_id,
  revoked_at) for JTI blacklisting.
- `d655b6eb282c` — Claude-derived theme columns on `reviews` (themes, complaints,
  praise, tone).

### Tooling

- **GSD (Get Shit Done) v1.38.5** installed locally via
  `npx get-shit-done-cc@latest --claude --local --minimal`. Adds 85 slash commands and a
  set of Claude Code hooks (context-window monitor, prompt-injection guard,
  read-before-edit guard, commit validation) wired into `.claude/settings.json`. User-
  invokable; doesn't change behavior on its own.
- **CI workflows**:
  - `.github/workflows/ci.yml` — backend pytest (62 cases) + frontend Jest (21 cases).
  - `.github/workflows/mobile-ci.yml` — mobile Jest (50 cases).
  - All three jobs run on every push to any branch + every PR to main.

### Ops / observability

- **Sentry user + JTI context**. `app/core/security.get_current_user` calls
  `sentry_sdk.set_user({"id": ..., "account_type": ...})` on every authenticated
  request, and `auth_service.refresh_session` tags the active refresh JTI on the
  Sentry scope. Errors in production now carry the user_id and refresh-token
  identity automatically — turns "500 in /api/consumer/recommendations" into
  "500 in /api/consumer/recommendations for user 4711, jti=ab12…", which is the
  difference between fixable and not.
- **`scripts/preflight.py`** — pre-merge gate. Cross-checks every `secrets.X`
  reference in `deploy-backend.yml` against the repo's actual GitHub Actions
  secrets via `gh secret list`, flags missing required ones, warns on optional
  ones, and verifies the env-var plumbing (workflow `env:` block ↔ `gcloud run
  deploy --set-env-vars`) actually carries each secret all the way to the
  container. `--strict` exits non-zero on warnings for CI use.
- **`GET /health/deep`** — authenticated deploy-time diagnostic. Reports
  per-integration state (`enabled` / `dormant` / `misconfigured`) so a
  half-configured Spotify pair (CLIENT_ID set, CLIENT_SECRET unset) is
  distinguishable from "feature off on purpose". Returns the cookie+token
  policy snapshot for env-var plumbing verification. Never returns secret
  VALUES — only flags. Boolean / numeric / state strings only. Existing
  `/health` stays anonymous and lightweight; `/health/deep` is the
  bearer-token version for runbook use.
- **`backend/scripts/backfill_themes.py`** — retroactive theme enrichment for
  reviews that pre-date PR #18. Walks `Review.themes IS NULL`, calls
  `extract_themes` on the comment, writes the JSON-encoded result back. Per-row
  commit so a network blip just leaves the unprocessed tail null; re-runs pick
  up where it stopped. `--dry-run` / `--limit N` / `--user-id N` flags.
  Idempotent and safe against the production DB.

### Tests

**165 automated tests** across three layers (79 backend / 33 web / 53 mobile). Full
path-coverage matrix on the AI/auth machinery:

|                         | Claude on (key set) | Claude off (key unset) | Claude fails (network/refusal) |
|-------------------------|---------------------|------------------------|--------------------------------|
| consumer recommendations | LLM                | rules                  | rules                          |
| diner recommendations    | LLM                | rules                  | rules                          |
| trends / marketing       | LLM                | rules                  | rules                          |
| training                 | LLM                | rules                  | rules                          |
| review save              | VADER + LLM themes | VADER only             | VADER only (theme cols null)   |
| review themes summary    | aggregated         | empty                  | partial                        |
| culinary assistant       | LLM                | "setup needed" message | "try-again" message            |

Mobile screen coverage matrix (each screen has at least empty-state, populated-state,
and primary-action assertions):

| Screen                       | Tests | What's verified                                              |
|------------------------------|-------|--------------------------------------------------------------|
| `services/api.js`            | 16    | tokenStore, X-Client-Type, Bearer auth, 401-refresh-retry, googleLogin |
| `contexts/AuthContext`       | 7     | mount restore, login/register/logout/loginGoogle state machine |
| `app/login.js`               | 4     | form submit, error surfacing, social fallback                |
| `app/(consumer)/assistant`   | 5     | greeting, send→reply, suggestion chips, error card           |
| `app/(consumer)/pantry`      | 4     | empty/full, add, find-recipes flow                           |
| `app/(consumer)/journal`     | 3     | empty/full, save                                             |
| `app/notifications`          | 4     | empty/full, mark-read on mount, legacy wrapper shape         |
| `app/(restaurant)/employees` | 3     | empty/full, create with role chip                            |
| `app/(diner)/restaurant/[id]`| 4     | restaurant info, slots, tap-to-book, no-slots empty          |

Web screen coverage matrix:

| Surface                    | Tests | What's verified                                                |
|----------------------------|-------|----------------------------------------------------------------|
| `services/api.js`          | 13    | credentials:include, 401-refresh-retry, login/refresh excluded |
| `context/AuthContext`      | 6     | mount-restore, cached hydration, login/register/logout         |
| `pages/login.js`           | 5     | form submit, social provider guard, NextAuth signIn            |
| `pages/sentiment.js`       | 4     | themes panel render contract (the bug catcher)                 |
| `pages/consumer/social.js` | 4     | Spotify reconnect nudge gating on user-top-read scope          |

### Known caveats

- **No UI smoke-test on a real device**. Sandbox can't simulate iOS/Android. Mobile SDK
  bumps were validated mechanically against Expo's published lockstep manifest; runtime
  regressions on first device run are possible (Reanimated 3→4 worklet runtime move,
  RN 0.79→0.83 deprecated style props, vector-icons 14→15).
- **Themes panel "0 enriched yet" empty state** — the panel now renders an explanatory
  empty state when reviews exist but none are enriched (Claude-less deploy or pre-PR-18
  backlog), pointing at `scripts/backfill_themes.py`. Closes the prior follow-up.
- **JTI revocation table is unbounded over a long enough horizon**. Pruned opportunistically
  on every refresh (delete-where-expired). At ≤30 day refresh-token TTL the table stays
  bounded by active-user × logouts/30d, which is fine for current scale but should switch
  to a proper background job at 100k+ daily users.

### Files touched

400+ across backend (Python/FastAPI/SQLAlchemy/Alembic), frontend (Next.js / React /
Tailwind), mobile (Expo SDK 55 / React Native 0.83 / expo-router), CI (GitHub Actions),
infra (Cloud Run deploy workflow). New top-level files:

- Backend: `app/services/claude_client.py`, `app/services/spotify_service.py`,
  `app/api/routes/oauth.py`, `app/core/encrypted_field.py`, `app/models/auth_revocation.py`
- Frontend: `pages/api/auth/social-bridge.js`
- Mobile (10 new screens): `app/(consumer)/{assistant,social,pantry,journal}.js`,
  `app/(restaurant)/employees.js`, `app/(diner)/restaurant/[id].js`,
  `app/notifications.js`
- Tests (13 new files): 4 backend (`tests/test_ai.py` and the auth/encryption/health
  suites that were already there got extended), 5 web (`__tests__/sentiment.test.js`,
  `__tests__/login.test.js`, `__tests__/social.test.js`, `services/__tests__/api.test.js`,
  `context/__tests__/AuthContext.test.js`), 9 mobile (api + AuthContext + login +
  assistant + pantry + journal + notifications + employees + restaurant detail)
- Alembic: 3 migrations (`4490178aadd3`, `2d78950e0987`, `d655b6eb282c`)
- CI: `.github/workflows/ci.yml` (backend + frontend), `.github/workflows/mobile-ci.yml`
- Tooling: `.claude/` directory (GSD framework, 362 files installed via npx, intentional)
- Docs: `CHANGELOG.md` (this)
