# Nocturna · App Store + Play Store submission runbook

Everything code-side is done: production Expo config (`mobile/app.config.js`),
EAS profiles (`mobile/eas.json`), store icons/splash (`mobile/assets/`),
listing copy (`mobile/store/listing.md`), privacy policy + terms
(`/privacy`, `/terms` on the web app), and in-app account deletion
(required by Apple 5.1.1(v) — Profile → Delete account on web + mobile).

What remains needs **your accounts and ~4 commands**. Follow in order.

---

## 0 · Prerequisites (one-time)

| What | Where | Cost |
|---|---|---|
| Apple Developer Program | https://developer.apple.com/programs/enroll/ | $99/year |
| Google Play Developer | https://play.google.com/console/signup | $25 once |
| Expo account | https://expo.dev/signup | free tier is fine |

Apple enrollment can take 24–48h (identity verification). Start it first.

**Deploy the backend first** (`DEPLOY.md`) — you need the real
`https://nocturna-api-….run.app` URL for the builds. Then replace the
`REPLACE-WITH-YOUR-nocturna-api.run.app` placeholders in
`mobile/eas.json` (both `preview` and `production` profiles) and the
fallback in `mobile/app.config.js`.

## 1 · Initialise EAS (once)

```bash
cd nocturna/mobile
npm install
npm install -g eas-cli
eas login                    # your Expo account
eas init                     # creates the EAS project
```

`eas init` prints a **project ID**. Because we use a dynamic config
(`app.config.js`), export it whenever you build:

```bash
export EAS_PROJECT_ID=<the-uuid-eas-init-printed>
```

(Or add it to your shell profile / CI secrets.)

## 2 · iOS — build + TestFlight + submit

```bash
# First build — EAS walks you through Apple sign-in and generates
# certificates + provisioning profiles automatically. Say yes to
# letting EAS manage credentials.
eas build --platform ios --profile production
```

While it builds (~15 min):

1. In **App Store Connect → My Apps → “+” → New App**: platform iOS,
   name **Nocturna**, primary language English (U.S.), bundle ID
   `app.nocturna.mobile` (it appears after the first EAS credential run),
   SKU `nocturna-ios`.
2. Copy the **Apple ID of the app** (numeric, App Information page) into
   `eas.json` → `submit.production.ios.ascAppId`.

Then:

```bash
eas submit --platform ios --latest
```

This uploads to TestFlight. Test it on your phone via the TestFlight app,
then in App Store Connect:

3. Fill the listing from `mobile/store/listing.md` (description, keywords,
   screenshots — capture them from the TestFlight build).
4. **App Privacy** section → answer per the table in `listing.md`.
5. **App Review Information** → paste the demo-account review notes from
   `listing.md`. Create the `review@nocturna.app` demo user first
   (register in the app, verify it via the admin notifications log, or
   pre-verify it directly in the DB).
6. Age rating questionnaire → “Alcohol, Tobacco, or Drug Use or
   References: Infrequent/Mild” → results in 17+.
7. Add the build → Submit for Review. First review: 1–3 days.

## 3 · Android — build + Play submit

```bash
eas build --platform android --profile production
```

1. In **Play Console → Create app**: name **Nocturna**, default language
   en-US, App (not game), Free.
2. **Play Console → Setup → API access**: create a **service account**
   with “Release manager” permissions, download its JSON key, save it as
   `nocturna/mobile/play-service-account.json` (it's gitignored — never
   commit it).
3. First upload must be manual: download the `.aab` from the EAS build
   page and upload it under **Testing → Internal testing → Create
   release**. (Play requires one manual upload before API submissions
   work.)
4. After that, future releases are:

```bash
eas submit --platform android --latest
```

5. Complete the store listing (from `listing.md`), the **Data safety**
   form (per the table in `listing.md` — declare account deletion with
   the URL `https://YOUR-WEB-URL/me/profile`), **Content rating**
   questionnaire (alcohol references → Mature 17+), and target-audience
   declarations.
6. Roll out Internal testing → Closed → Production as confidence grows.
   First production review: usually 1–7 days for a new developer account.

## 4 · Push notifications (production)

- **iOS**: `eas credentials -p ios` → let EAS create the APNs key.
- **Android**: FCM is configured automatically by EAS for Expo
  notifications. Nothing to do unless you add your own FCM server key.

## 5 · Preview builds for testers (optional but recommended first)

```bash
eas build --platform all --profile preview
```

Produces an installable APK + ad-hoc iOS build with bundle id
`app.nocturna.mobile.preview` — installs alongside the store app.
Distribute via the QR code on the EAS build page.

## 6 · Release checklist (before hitting Submit)

- [ ] Backend deployed; `NOCTURNA_API_URL` placeholders replaced (must be `https://`)
- [ ] `NEXT_PUBLIC_SITE_URL` set on the web deploy — privacy links in the
      stores point at `https://YOUR-WEB-URL/privacy`
- [ ] `review@nocturna.app` demo account created + email-verified
- [ ] Stripe live keys set (or IAP disabled for v1 — the app works free)
- [ ] Booking flow smoke-tested end-to-end from the preview build on a
      real phone (plan → book → admin confirms → push/SMS/email arrives)
- [ ] Screenshots captured (6 per platform, see listing.md)
- [ ] Support email works (support@nocturna.app or your real inbox)

## Known review risks (and why we're covered)

| Risk | Mitigation |
|---|---|
| 5.1.1(v) account deletion | In-app Delete account on web + mobile → `DELETE /api/auth/me` |
| Privacy policy missing | `/privacy` page, linked in footer + both store listings |
| Demo account missing | Review notes template in listing.md — create it before submitting |
| Alcohol content rating | Declare 17+/Mature honestly (Lifestyle app, no sales of alcohol) |
| http:// API (ATS) | Production config refuses to default to http; builds bake https URL |
| Minimal-functionality (4.2) | App has planner, maps, bookings, chat, groups — comfortably above bar |

## Version bumps for future releases

`eas.json` sets `appVersionSource: remote` + `autoIncrement` on the
production profile — EAS bumps `buildNumber`/`versionCode` automatically
per build. Bump the human-visible `version` in `app.config.js` manually
when you ship features (1.0.0 → 1.1.0).
