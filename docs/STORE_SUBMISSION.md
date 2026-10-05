# SavoryMind — App Store & Google Play submission runbook

_Definitive, current steps to get the mobile app live on the Apple App Store and
Google Play. Split by **✅ ready / done in the repo** vs **🔑 only Bruno can do**
(accounts, payment, 2FA, signing credentials)._

App: **SavoryMind** · Expo / React Native (`mobile/`) · version **1.0.0**
Bundle ID (iOS): `net.savorymind.app` · Package (Android): `net.savorymind.app`

---

## 0. What's already in place ✅

- `mobile/app.json` — name, slug, version, bundle id / package, Apple Sign In,
  camera/photos/notifications permission strings, adaptive icon, scheme.
- `mobile/eas.json` — build (production, auto-increment) + submit profiles for
  both stores.
- **iOS App Store Connect app record already exists** — `ascAppId: 6769830917`
  (in `eas.json`). So the iOS "app shell" is created; it needs a build + metadata.
- Store-listing copy (IT + EN, both stores): `docs/store-listing.md`.
- Privacy policy + terms are live on the web: `https://savorymind.net/legal/privacy`,
  `https://savorymind.net/legal/terms` (required by both stores).

## ⚠️ One asset to improve before (or right after) first submit
`mobile/assets/{icon,splash,adaptive-icon,favicon}.png` are currently the **same
1254×1254 image**. It will build, but:
- iOS icon should be a **1024×1024** square, no transparency, no rounded corners (Apple rounds it).
- Android **adaptive-icon** foreground should keep the logo inside the center ~66% "safe zone" or the circular mask crops it.
- Splash ideally is a smaller centered logo on the brand background, not the full icon.
Not a hard blocker for TestFlight/internal testing; fix before public release.

---

## 1. Accounts & credentials 🔑 (Bruno — one-time)

| Need | Where | Cost |
|---|---|---|
| **Apple Developer Program** membership | developer.apple.com/programs | $99/yr |
| **App Store Connect API key** (`.p8`) + Key ID + Issuer ID | App Store Connect → Users and Access → Integrations → App Store Connect API | free |
| **Google Play Console** account | play.google.com/console | $25 one-time |
| **Play service account JSON** (for `eas submit`) | Play Console → Setup → API access → create/link a Google Cloud service account, grant "Release" | free |
| **Expo (EAS) account** | expo.dev — `eas login` | free tier OK |

Put the two secret files where `eas.json` expects them (do **not** commit — both are
git-ignored territory):
- `mobile/asc-api-key.p8` (Apple) + set env `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`
- `mobile/play-service-account.json` (Google)

> These land in `docs/NEEDS-BRUNO.md` as the blocking items.

---

## 2. Build & submit — iOS 🔑

From `mobile/`, with EAS CLI installed (`npm i -g eas-cli`) and `eas login` done:

```bash
cd mobile
# First time only: let EAS manage signing (creates the distribution cert +
# provisioning profile in your Apple account). Answer the prompts with the Apple ID.
eas build --platform ios --profile production
# When the build finishes, submit it to App Store Connect (app id already set):
eas submit --platform ios --profile production --latest
```

Then in **App Store Connect** (appstoreconnect.apple.com):
1. Paste the listing from `docs/store-listing.md` (name, subtitle, description, keywords, promo text, support URL, privacy URL).
2. Upload screenshots (see §4).
3. **App Privacy** questionnaire — data collected: email + name (account), usage/diagnostics if analytics on. Link the privacy policy.
4. Add a **demo account** in "App Review Information" (a test login) so reviewers can get past the sign-in gate — Apple rejects apps they can't log into.
5. Set age rating, category (Food & Drink), pricing (Free).
6. Submit for review (build first goes to TestFlight; you can test internally, then submit that build for App Store review).

## 3. Build & submit — Android 🔑

```bash
cd mobile
eas build --platform android --profile production   # produces an .aab
eas submit --platform android --profile production --latest
```
`eas.json` submits to the **internal** track as a **draft** first (safe). Then in **Play Console**:
1. Create the app (if not already) — package `net.savorymind.app`, category Food & Drink, free.
2. Paste the listing from `docs/store-listing.md` (title, short + full description).
3. Upload screenshots + a 512×512 icon + 1024×500 feature graphic.
4. Complete **Data safety**, **Content rating** (IARC questionnaire), **Target audience**, **Privacy policy URL**.
5. Provide a **test login** in the "App access" section (same reason as Apple — reviewers must get past auth).
6. Promote the internal draft → closed/open testing → production when ready.

## 4. Screenshots 🔑/✅
Needed per store (can be captured from the running app in a simulator/emulator):
- **iOS:** 6.7" (1290×2796) and 6.5" (1242×2688) — at least 3 each.
- **Android:** phone screenshots 1080×1920+ — at least 2, plus the 1024×500 feature graphic.
Suggested shots: the "Buongiorno" command-center / consumer home, menu-snap AI pick,
wine pairing, dine-out discover, the loss/coaching dashboard (restaurant side).
I can generate a capture checklist + on-device script if you want; the actual
capture needs a booted simulator (your machine or an EAS build).

## 5. Pre-submit review checklist ✅ (I keep this current)
- [ ] App builds green (CI: Mobile Jest passing).
- [ ] Version bumped in `app.json` for each new submission (1.0.0 → 1.0.1 …).
- [ ] Demo/test account created and put in both stores' review notes.
- [ ] Privacy policy + terms URLs resolve (they do).
- [ ] Permission strings present and honest (camera/photos/notifications — they are).
- [ ] No crashes on a cold launch of a fresh account (empty-state screens all handled).
- [ ] `usesNonExemptEncryption: false` set (it is) — skips export-compliance prompts.

---

## What I (Claude) can do without you
- Keep this runbook + `docs/store-listing.md` current and correct.
- Bump the app version, tune `app.json` / `eas.json`, fix any config the stores flag.
- Write/adjust all listing copy, keywords, and review notes.
- Prepare a screenshot capture plan and empty-state polish so review goes smoothly.

## What only you can do
- Create/pay the Apple Developer + Google Play accounts.
- Generate the ASC API key + Play service-account JSON and drop them in `mobile/`.
- Run `eas build` / `eas submit` (they need your Apple/Google/Expo logins + 2FA),
  or hand me the credentials via your own secure setup if you want me to script it.
- Click "Submit for review" in each console.
