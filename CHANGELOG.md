# Changelog

Project-level changelog. Reverse-chronological. New entries go at the top.

## Unreleased — PR #18

A 26-commit consolidation that started as three security audit fixes and grew into
a full security + AI + multi-platform overhaul. Branch
`claude/fix-screenshot-api-error-8JNoK`. **Squash on merge** is the right strategy —
the per-commit history is useful for bisecting if something regresses, but `main`
doesn't need 26 entries.

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
  - `.github/workflows/mobile-ci.yml` — mobile Jest (29 cases).
  - All three jobs run on every push to any branch + every PR to main.

### Tests

113 automated tests across three layers, full path-coverage matrix on the AI/auth
machinery:

|                         | Claude on (key set) | Claude off (key unset) | Claude fails (network/refusal) |
|-------------------------|---------------------|------------------------|--------------------------------|
| consumer recommendations | LLM                | rules                  | rules                          |
| diner recommendations    | LLM                | rules                  | rules                          |
| trends / marketing       | LLM                | rules                  | rules                          |
| training                 | LLM                | rules                  | rules                          |
| review save              | VADER + LLM themes | VADER only             | VADER only (theme cols null)   |
| review themes summary    | aggregated         | empty                  | partial                        |
| culinary assistant       | LLM                | "setup needed" message | "try-again" message            |

### Known caveats

- **No UI smoke-test on a real device**. Sandbox can't simulate iOS/Android. Mobile SDK
  bumps were validated mechanically against Expo's published lockstep manifest; runtime
  regressions on first device run are possible (Reanimated 3→4 worklet runtime move,
  RN 0.79→0.83 deprecated style props, vector-icons 14→15).
- **The new themes panel doesn't show a "0 enriched yet" empty state** — it just hides.
  Users on a deploy without `ANTHROPIC_API_KEY` see no panel and no explanation. Could be
  surfaced as a follow-up.
- **JTI revocation table is unbounded over a long enough horizon**. Pruned opportunistically
  on every refresh (delete-where-expired). At ≤30 day refresh-token TTL the table stays
  bounded by active-user × logouts/30d, which is fine for current scale but should switch
  to a proper background job at 100k+ daily users.

### Files touched

390+ across backend (Python/FastAPI/SQLAlchemy/Alembic), frontend (Next.js / React /
Tailwind), mobile (Expo SDK 55 / React Native 0.83 / expo-router), CI (GitHub Actions),
infra (Cloud Run deploy workflow). New top-level files: `CHANGELOG.md` (this),
`backend/app/services/claude_client.py`, `backend/app/services/spotify_service.py`,
`backend/app/api/routes/oauth.py`, `backend/app/core/encrypted_field.py`,
`backend/app/models/auth_revocation.py`, `frontend/src/pages/api/auth/social-bridge.js`,
`mobile/app/(consumer)/assistant.js`, `mobile/app/(consumer)/social.js`, plus 8 test
files and 3 Alembic migrations.
