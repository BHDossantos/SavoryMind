# SavoryMind — Submission Checklist

> Single source of truth for everything you need to do post-merge to ship to App Store + Play Store.
> Replaces "go grep across PR bodies + DEPLOYMENT.md."
> Items marked `[OPERATOR]` need YOUR access to a third-party console; I cannot do these from this codebase.
> Cross-references: `SUBMISSION-METADATA.md` (copy for every store form), `DEPLOYMENT.md` (production deploy runbook), each PR body.

---

## Phase A — Account setup (do once)

### A1. Apple Developer Program — `[OPERATOR]` `~$99 + 24-48h wait`

1. Go to https://developer.apple.com/programs/
2. Click **Enroll** — pick Individual or Business (Individual is faster, Business gives you a real legal entity name on the App Store listing)
3. Pay $99 USD annual fee
4. Wait for Apple to approve (24-48h typical, up to a week if Business)
5. Once approved, sign in to https://developer.apple.com/account/

### A2. Google Play Console — `[OPERATOR]` `$25 one-time`

1. Go to https://play.google.com/console/
2. Pay $25 one-time registration fee
3. Provide developer name (this is what shows under your app name on the store)
4. Approval is usually within hours
5. Sign in to https://play.google.com/console/

### A3. Apple bundle identifier + Sign in with Apple capability — `[OPERATOR]` `~5 min`

1. https://developer.apple.com/account/resources/identifiers/list
2. Click `+` → App IDs → App
3. Bundle ID: `net.savorymind.app` (exact match to `mobile/app.json`)
4. Capabilities: scroll down, check **Sign in with Apple** ✅
5. Continue → Register

### A4. App Store Connect app record — `[OPERATOR]` `~5 min`

1. https://appstoreconnect.apple.com → My Apps → `+` → New App
2. Platforms: iOS
3. Name: `SavoryMind`
4. Primary language: English (U.S.)
5. Bundle ID: `net.savorymind.app` (will appear in dropdown after A3)
6. SKU: `savorymind-ios-001` (your internal identifier, never seen by users)
7. User Access: Full Access (default)

### A5. Google Play Console app record — `[OPERATOR]` `~5 min`

1. Play Console → Create app
2. App name: `SavoryMind`
3. Default language: English (U.S.)
4. App or game: App
5. Free or paid: Free
6. Confirm declarations (developer program policies, US export laws)

---

## Phase B — Backend / infrastructure prep

### B1. Set `APPLE_BUNDLE_ID` in GitHub Actions secrets — `[OPERATOR]` `~2 min`

```sh
gh secret set APPLE_BUNDLE_ID --repo BHDossantos/SavoryMind
# paste: net.savorymind.app
```

Or via web UI: https://github.com/BHDossantos/SavoryMind/settings/secrets/actions → New secret → Name `APPLE_BUNDLE_ID` Value `net.savorymind.app`

### B2. Add `APPLE_BUNDLE_ID` to deploy workflow — `[CODE — separate PR or fold into PR #21]`

`.github/workflows/deploy-backend.yml` needs the env var added to the env block AND the `--set-env-vars` line on the gcloud run deploy step. Pattern matches `GOOGLE_CLIENT_ID`. PR #21's body lists this as a follow-up; can land as a one-line PR after merge. I can do it once you confirm the bundle ID is locked at `net.savorymind.app`.

### B3. Verify privacy policy + terms render on deployed frontend — `[OPERATOR]` `~2 min`

After PR #21 merges and frontend deploys:
- https://savorymind.net/legal/privacy → renders
- https://savorymind.net/legal/terms → renders

Both URLs are required by App Store + Play Store submission forms.

### B4. Create the App Review demo accounts — `[OPERATOR]` `~5 min`

Apple App Review needs working credentials to test the app. Create both via the live signup flow:

1. Sign up at https://savorymind.net/signup
2. Email: `appreview-consumer@savorymind.net`
3. Password: `Review-Demo-2026!`
4. Account type: Consumer
5. Complete onboarding with reasonable defaults

Then a second account with `appreview-restaurant@savorymind.net` / same password / account_type=restaurant.

> ⚠ The email domain `savorymind.net` needs catch-all email working OR a real Resend-backed inbox to receive verification. Easiest: use `+appreview-consumer@savorymind.net` against your existing inbox if your provider supports `+` addressing.

### B5. Create `/support` page — `[CODE — small follow-up]`

Apple requires a working Support URL. Currently `SUBMISSION-METADATA.md` lists `https://savorymind.net/support` as the placeholder. We need either:
- A simple `frontend/src/pages/support.js` page (~20 lines, similar to the privacy/terms pages — contact email + FAQ stub), OR
- Update `SUBMISSION-METADATA.md` to use `mailto:hello@savorymind.net`

Recommend the page; takes 10 minutes and looks more legitimate than `mailto:`. I can build it now if you say so.

---

## Phase C — Asset production — `[OPERATOR or designer]`

### C1. App icon (1024×1024 PNG) — `~30 min in design tool`

Constraints:
- Exactly 1024×1024 pixels
- PNG, no alpha channel, no transparency
- No rounded corners (Apple/Google add those automatically)
- Should render legibly at 60×60 (the smallest size shown in iOS Spotlight)

Currently `mobile/assets/icon.png` is a generic Expo placeholder. Replace it.

### C2. Adaptive icon for Android — `~15 min after C1 is done`

Two layers:
- **Foreground** (`mobile/assets/adaptive-icon.png`): 1024×1024 PNG with the SavoryMind mark inside the central 432×432 safe zone (everything outside gets cropped on circular launchers)
- **Background**: solid color (currently `#ffffff` in `app.json`) — change to your brand color if you have one

### C3. Splash screen — `~15 min`

Currently `mobile/assets/splash.png` is a generic Expo placeholder. Should match the icon's design language. 1284×2778 (6.7" iPhone size; Expo will scale down for other devices).

### C4. App Store screenshots — `~1 hour after a TestFlight build is ready`

5 phone screenshots at 1290×2796 (6.9" iPhone). See `SUBMISSION-METADATA.md` § Screenshots for the suggested lineup.

How to capture:
1. Get the TestFlight build on a real iPhone (phase D)
2. Sign in as the demo restaurant account
3. Open each target screen, take screenshots (Side button + Volume Up)
4. AirDrop to your Mac
5. Lightly caption in Figma / Keynote / your preferred tool
6. Export as PNG at exactly 1290×2796

Repeat for iPad if you support it (12.9" iPad Pro at 2048×2732). We have `supportsTablet: true` in `app.json` so iPad screenshots ARE required for App Store.

### C5. Play Store assets — `~30 min`

- **Feature graphic**: 1024×500 banner, your call on design
- **Phone screenshots**: 5-8 at 1080×1920 minimum, can reuse the iOS screenshots cropped/resized
- **Tablet screenshots**: optional but valuable — can skip on first submission

---

## Phase D — Build + submit — `[OPERATOR via CLI]`

### D1. Configure EAS (one-time per platform) — `~10 min`

Both platforms need EAS auth + project linking:

```sh
cd mobile
eas login                    # browser opens to expo.dev
eas build:configure          # links the project to your Expo account
```

Verify `mobile/eas.json` has a `production` profile (it should from existing setup):
```json
{
  "build": {
    "production": {
      "node": "22.x.x",
      "ios":     { "image": "latest" },
      "android": { "image": "latest" }
    }
  }
}
```

### D2. Set EAS env vars — `[OPERATOR]` `~5 min`

```sh
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value "https://api.savorymind.net"
eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "<your Google client ID>"
```

(Bundle identifier doesn't need a env var — it's in `app.json`.)

### D3. iOS build → TestFlight → App Store — `[OPERATOR]` `~30-45 min build + 24-72h review`

```sh
cd mobile

# 1. Build production iOS binary (~20-30 min, EAS handles signing)
eas build --platform ios --profile production

# 2. Submit to App Store Connect
eas submit --platform ios --latest

# 3. In App Store Connect:
#    - Wait ~30 min for the build to finish processing
#    - Add to TestFlight internal testing (your email auto-included)
#    - Install via TestFlight on a real device
#    - Smoke-test golden paths: signup → consumer dashboard, login → restaurant dashboard
#    - Submit demo credentials in the "App Review Information" section
#    - Click "Submit for Review"
#
# 4. Wait 1-3 days for Apple review (often faster after first submission).
#    Likely rejection reasons:
#    - Missing Sign in with Apple → already implemented
#    - Demo creds don't work → re-test before submission (Phase B4)
#    - Privacy policy URL 404 → verify after frontend deploy (Phase B3)
#    - App crashes on first launch → real-device test in TestFlight
```

### D4. Android build → internal testing → production — `[OPERATOR]` `~30 min build + ~1d review`

```sh
cd mobile

# 1. Build production Android AAB
eas build --platform android --profile production

# 2. Submit to internal testing track (instant)
eas submit --platform android --latest --track internal

# 3. In Play Console:
#    - Add 2-5 internal testers by email
#    - Install via the Play Store internal testing link
#    - Smoke-test on a real Android device
#
# 4. When ready for public launch:
#    Play Console → Release → Production → Create new release →
#    promote build from internal track → roll out to 100% (or staged %)
```

---

## Phase E — Post-launch monitoring

### E1. Crash reporting

`SENTRY_DSN` is already set in production from PR #18. Errors flow to Sentry automatically with user_id + JTI tags.

### E2. App Store Connect → App Analytics

- Daily active users
- Session count
- Crash rate (should be <0.1% for a healthy app)
- App Store impressions + downloads

### E3. Play Console → Statistics

Same metrics, slightly different shape.

### E4. Review responses

Both stores let you reply to user reviews from the console. First negative review usually shows up within a week of public launch — be ready to triage.

---

## Status as of this document being written

- **Code** complete:
  - PR #20 (inventory) — open, all CI green
  - PR #21 (Apple Sign In + privacy/terms) — open, Mobile Jest fix pushed (`bbcb3ec`), waiting on CI
  - PR #22 (mobile parity backport) — open, all CI green
- **Operator-side TODOs:** all of Phase A + B + C + D + E above. Estimated calendar time: 2-3 weeks if you do it in evenings, ~1 week if focused.

---

*Drafted: 2026-05-07. Re-read before each submission — Apple's policies in particular change every couple WWDC cycles.*
