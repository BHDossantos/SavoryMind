# SavoryMind — Mobile App Deployment Guide

Everything that has to happen to get SavoryMind from `git push` to the
App Store and Google Play, in the order it has to happen. iOS and
Android can be done in parallel — they share zero credentials.

The codebase is fully ready: Expo SDK 55, EAS configured, the
`EAS Mobile Build` GitHub Action fires on every mobile commit and
produces signed binaries on Expo's build farm. What this doc covers is
everything *outside* the code — the accounts, the credentials, the
store listings, the submission flow.

---

## 0. Prerequisites you'll need anyway

- Apple ID with **paid Apple Developer Program enrollment** ($99/yr).
  Apply at [developer.apple.com](https://developer.apple.com/programs).
  Approval takes 24–48 hours; do this first, the rest waits on it.
- **Google Play Developer account** ($25 one-time).
  Sign up at [play.google.com/console/signup](https://play.google.com/console/signup).
  Approval is usually same-day.
- A Mac is **not** required — EAS builds everything in the cloud.
- The EAS CLI installed locally for the one-time setup commands:
  ```
  npm install -g eas-cli
  eas login
  ```

---

## 1. iOS path (App Store)

### 1a. App Store Connect — confirm the app exists

Your `eas.json` already references App Store Connect app id
`6769830917`. Open
[appstoreconnect.apple.com](https://appstoreconnect.apple.com), go to
**My Apps**, and confirm "SavoryMind" appears. If it does, skip to 1b.
If not:

1. **My Apps → +** → New App
2. Platform: iOS
3. Name: **SavoryMind**
4. Bundle ID: select `net.savorymind.app` (must already exist as an
   App ID in [developer.apple.com](https://developer.apple.com) →
   Certificates, Identifiers & Profiles → Identifiers; create it if
   not — must enable "Sign in with Apple" capability)
5. SKU: anything unique, e.g. `savorymind-ios-001`
6. Note the new app id and replace `6769830917` in `mobile/eas.json` →
   `submit.production.ios.ascAppId`.

### 1b. App Store Connect API key (the one-time hard part)

EAS needs API access to upload builds and submit them. This is **not**
a regular app-specific API key — it's a global App Store Connect key.

1. App Store Connect → **Users and Access** → **Integrations** →
   **App Store Connect API** → **Keys** tab → **+** to generate a new
   key.
2. Name: `EAS submission`. Access: **App Manager**.
3. Download the `.p8` file. **Apple shows the file once — do not lose it.**
4. From the same page, note two values:
   - **Issuer ID** (looks like a UUID, top of the page)
   - **Key ID** (10-character string next to your key)

### 1c. GitHub secrets for iOS submission

In your repo: Settings → Secrets and variables → Actions → New repository
secret. Add three secrets:

| Secret | Value |
| --- | --- |
| `ASC_API_KEY_ID` | the 10-char Key ID from 1b |
| `ASC_API_ISSUER_ID` | the Issuer UUID from 1b |
| `ASC_API_KEY_P8` | the **full contents** of the .p8 file (paste, including `-----BEGIN PRIVATE KEY-----` lines) |

The submit step writes the .p8 to disk on the runner before invoking
`eas submit`. We'll add that step in 1f.

### 1d. iOS code-signing credentials (let EAS manage them)

First time only — run locally:

```bash
cd mobile
eas credentials -p ios
```

Choose **App Store** → **Set up a new build credentials**. Sign in
with your Apple ID. EAS generates a Distribution Certificate + the
App Store Provisioning Profile and stores both in its credential vault.
You'll never touch them again unless they expire (1 year).

When prompted "Sign in with Apple" capability — accept; SavoryMind
requires it on iOS because we offer Google sign-in.

### 1e. First production build

Either trigger from GitHub Actions UI (**Actions → EAS Mobile Build →
Run workflow** → platform `ios`, profile `production`) — or locally:

```bash
cd mobile
eas build --platform ios --profile production
```

25–35 minutes later, EAS posts a signed `.ipa` to your Expo dashboard
at `expo.dev/accounts/<account>/projects/savorymind/builds`.

### 1f. Submit the .ipa to TestFlight

```bash
cd mobile
# Materialize the .p8 from the GitHub secret (locally, just have the
# file at mobile/asc-api-key.p8 — DO NOT commit it; .gitignore already
# blocks *.p8 by default in Expo projects, verify first).
eas submit --platform ios --latest
```

This uses the eas.json submit block: ascAppId is hard-coded, the rest
read from `ASC_API_KEY_ID` / `ASC_API_ISSUER_ID` env vars. EAS uploads
to TestFlight. You'll get an email from Apple within 10–30 minutes once
the build finishes processing.

### 1g. Internal TestFlight smoke test

In App Store Connect:
1. TestFlight → Internal Testing → **+** new group → "Pilot"
2. Add yourself + a few internal testers by Apple ID email
3. Once the build's processed (~30 min after upload), it shows in the
   Builds list. Add it to the Pilot group.
4. Open TestFlight on iPhone, install, run the §6 smoke test from
   `LAUNCH-CHECKLIST.md`.

### 1h. Public App Store release

When TestFlight smoke passes:
1. App Store Connect → SavoryMind → **App Store** tab → **+ Version**
2. Fill the listing: 
   - **Description**: lead with "Tell us how you feel. We'll tell you
     what to eat." Use the same copy as the landing page.
   - **Keywords** (100 chars): `restaurant,booking,reserve,wine,pairing,food,recipes,menu,AI,sommelier`
   - **Screenshots**: 6.7" iPhone (1290×2796) and 6.5" iPhone — minimum 3
     each. Most efficient way: run the app in the iOS simulator, snap
     `Cmd+S` on Mood-to-Meal result, Snap-a-Menu result, restaurant
     bookings dashboard, restaurant onboarding.
   - **Privacy Policy URL**: `savorymind.net/legal/privacy`
   - **Support URL**: `savorymind.net/support`
   - **Category**: Food & Drink (primary), Lifestyle (secondary)
   - **Age rating questionnaire**: alcohol references (wine pairing) →
     "Infrequent/Mild" — App Store gives 12+
3. **Build** section → select the TestFlight build.
4. **App Review Information**:
   - **Demo account**: create a `reviewer@savorymind.net` consumer
     account with completed onboarding so reviewers can sign in.
   - **Notes**: "Mood-to-Meal and Snap-a-Menu are AI-powered food
     recommendation flows; both work without signup. Restaurant
     dashboard requires a restaurant account."
5. **Submit for Review**. Apple takes 24-48 hours.

**Common rejection — avoid up front:** Guideline 4.8 (Sign in with
Apple) — Apple requires it when you offer Google sign-in. SavoryMind
already implements it (`usesAppleSignIn: true` in app.json + the
backend `apple_signin` integration). The `apple_bundle_id` env var on
the backend must be set to `net.savorymind.app` exactly, or the
`/api/auth/apple` endpoint 503s during review and the build is
rejected. Verify on `/health/deep` — `apple_signin: enabled`.

---

## 2. Android path (Google Play)

### 2a. Create the Google Play app entry (manual, one-time)

EAS can't create the app entry in Google Play Console — you have to do
it manually the first time. Subsequent submissions are scripted.

1. [play.google.com/console](https://play.google.com/console) →
   **Create app**.
2. App name: **SavoryMind**, Default language: English, App type:
   App, Free.
3. Accept the standard policies.
4. **App content** section — declare:
   - Privacy policy: `savorymind.net/legal/privacy`
   - App access: provide the reviewer demo account from 1h.4
   - Ads: No (we don't run ads)
   - Content rating questionnaire → answer wine/alcohol → IARC gives
     "Teen"
   - Target audience and content → 18+ (alcohol pairing recommendations)
   - Data safety → uses Camera (menu photos), Email, Phone Number,
     Location (city only, for restaurant matching)

### 2b. Initial APK upload (Google's one-time gate)

Google **will not let `eas submit` work until at least one build has
been uploaded manually** through the console for the app's chosen
track. Workaround: build the AAB once locally and upload by hand.

```bash
cd mobile
eas build --platform android --profile production
# Download the .aab from the EAS dashboard once the build completes.
```

In Play Console → SavoryMind → **Testing → Internal testing** →
**Create new release** → upload the `.aab` → fill release notes
("Initial build") → save → **Review release** → roll out.

This unlocks the API for `eas submit`.

### 2c. Service account JSON for `eas submit`

This is Android's equivalent of the App Store Connect API key.

1. [Google Cloud Console](https://console.cloud.google.com) → select
   any project (or create `savorymind-mobile-submit`) → **IAM & Admin**
   → **Service Accounts** → **+ Create**.
2. Name: `eas-submit`. Skip the role-grant step in Cloud Console.
3. After creation → service account row → **Keys** tab → **Add key →
   Create new key → JSON** → download. **Do not lose this file.**
4. Now in **Play Console** → **Users and permissions** → **Invite new
   user** → email is the service account's email (looks like
   `eas-submit@…iam.gserviceaccount.com`) → Permissions:
   - **Release apps to testing tracks**
   - **Release apps to production, exclude device types, and use Play
     App Signing** (only if you want production submission later)
   - **View app information and download bulk reports**
5. Send invitation → it auto-accepts for service accounts.

### 2d. GitHub secret for Android submission

Add one repo secret:

| Secret | Value |
| --- | --- |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | the full contents of the JSON file from 2c |

The submit step writes it to `mobile/play-service-account.json` at
submission time (matching the path in `eas.json` →
`submit.production.android.serviceAccountKeyPath`).

### 2e. From now on, every Android release

```bash
cd mobile
eas build --platform android --profile production
eas submit --platform android --latest
```

`eas.json` is configured to submit to the **internal** track as a
**draft** so the build appears in Play Console waiting for you to roll
it out. Promote internal → closed (alpha/beta) → production manually
from the console UI until the listing is stable, then change `track`
in `eas.json` to `production` to ship straight to public.

---

## 3. Make the two CI workflows do the submit automatically (optional)

The existing `EAS Mobile Build` workflow builds on every push to main
but does **not** submit. To turn the loop into "merge to main → app in
TestFlight + Play internal track in 35 min," extend the workflow with a
submit step that runs after the build completes.

The cheapest path: don't auto-submit at all. Let the workflow build,
then run `eas submit --latest` from your laptop when you actually want
to release. Auto-submit on every commit creates TestFlight noise
nobody wants and burns review budget. The current setup is the right
default.

If you do want auto-submit on a release tag (e.g. `mobile-v1.0.0`),
add a separate workflow keyed on `push: tags: ['mobile-v*']` that runs
`eas submit --platform all --latest --non-interactive` with the
secrets materialized into files first. I can write that file when
you've decided the trigger you want.

---

## 4. Versioning

`eas.json` → `production.autoIncrement: true` means EAS bumps the
build number on every production build automatically. The marketing
version (`1.0.0`, `1.1.0`, …) lives in `mobile/app.json`'s
`expo.version`. **Bump that manually when you ship a meaningful
release**; Apple/Google will reject submissions whose version equals an
already-published one.

---

## 5. Where each piece lives — quick reference

| What | Where |
| --- | --- |
| iOS bundle id | `mobile/app.json` → `ios.bundleIdentifier` |
| Android package | `mobile/app.json` → `android.package` |
| App Store Connect app id | `mobile/eas.json` → `submit.production.ios.ascAppId` |
| iOS submit credentials | GitHub secrets `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, `ASC_API_KEY_P8` |
| Android submit credentials | GitHub secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| Camera/photos permission strings | `mobile/app.json` → `expo.plugins` |
| Apple Sign-In capability | `mobile/app.json` → `ios.usesAppleSignIn: true` |
| EAS account that owns builds | `eas login` on the machine that runs builds |
| Build CI workflow | `.github/workflows/eas-mobile-build.yml` |

---

## 6. Common gotchas

- **Apple Sign-In is mandatory** when offering Google sign-in. We have
  it, but the backend `APPLE_BUNDLE_ID` env var must match
  `net.savorymind.app` exactly or `/api/auth/apple` returns 503 during
  App Review and the build is rejected. Verify with the `/health/deep`
  probe: `apple_signin` should read `enabled`.
- **First Android submission must be manual**. `eas submit --platform
  android` fails until an APK/AAB has been uploaded by hand to at least
  one track. Step 2b covers this.
- **Version numbers can't repeat**. Bump `expo.version` in
  `mobile/app.json` for every shipped release.
- **Privacy Policy URL must resolve**. `savorymind.net/legal/privacy`
  exists, but verify it's reachable from the public internet (no
  Cloudflare gate, etc.) — reviewers click it.
- **Camera permission must have a real reason string**. Already set in
  `mobile/app.json`'s `expo-image-picker` plugin config. Editing it to
  a placeholder rejects on review.

---

## TL;DR — the path on a calendar

| Day | Action |
| --- | --- |
| Day 0 | Apply Apple Developer ($99) + Google Play ($25). Wait. |
| Day 1–2 | Apple approval. App Store Connect app entry exists. |
| Day 2 | Create ASC API key (1b), add the 3 iOS GitHub secrets (1c) |
| Day 2 | `eas credentials -p ios` once (1d). Trigger production build (1e). |
| Day 2 | `eas submit -p ios --latest` (1f). TestFlight available in 30 min. |
| Day 2 | First Android build, upload to Play Internal manually (2b). |
| Day 2 | Service account JSON (2c) + GitHub secret (2d). Submit (2e). |
| Day 3 | TestFlight smoke test + Play internal test, on real devices. |
| Day 4 | Submit App Store + Play production. Apple review 1–2 days, Google ~few hours. |
| Day 5–6 | Live on both stores. |

Total wall-clock: about a week, mostly spent waiting on Apple.
