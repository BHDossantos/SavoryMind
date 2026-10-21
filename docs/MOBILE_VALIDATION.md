# SavoryMind mobile validation and launch gates

Audited 2026-10-21 against `e5d8fb7c964e9d2119f56d9dffc2e2b43c9dc7fb`.

## Existing mobile implementation

`mobile/` is an Expo SDK 55 / React Native 0.83 app using Expo Router. Both
native identifiers are `net.savorymind.app`. An EAS project and App Store
Connect app ID are configured. Native projects are generated, not committed.
This is a real mobile implementation, not only a responsive website.

`Mobile CI` runs Jest; the [latest audited run](https://github.com/BHDossantos/SavoryMind/actions/runs/38820216456)
passed on the commit above. Jest mocks native modules, so it does not establish
that native configuration, bundling, signing, or device behavior works.

## Added secret-free validation

`Mobile Bundle Validation` independently checks iOS and Android changes on
pull requests and main, and can be run manually:

1. Install exactly the mobile lockfile.
2. Resolve the Expo app configuration.
3. Run platform-specific Expo prebuild without installing/signing native dependencies.
4. Export a production JavaScript/asset bundle for that platform.
5. Keep the bundle and public resolved configuration as commit-specific artifacts.

No Expo token, store credentials, EAS build, submit, deployment, or production
API calls are used. Artifacts deliberately use a non-production placeholder
API URL. These are validation bundles, **not installable APK/IPA files** and
not an EAS Update. Download them for inspection, not distribution.

Locally, in `mobile/`:

```sh
npm ci --ignore-scripts
npm test -- --ci --runInBand
npx --no-install expo config --type public --json
npx --no-install expo prebuild --platform android --no-install
npx --no-install expo export --platform android --output-dir dist-android --max-workers 2
npx --no-install expo prebuild --platform ios --no-install
npx --no-install expo export --platform ios --output-dir dist-ios --max-workers 2
```

Prebuild creates native folders and can update package scripts. Run it in a
clean disposable checkout; do not commit generated native output unless the
team deliberately switches to maintaining native projects. Native compilation is automated separately below; an EAS build remains a
separate, independently authorized release action.

## Secret-free native compilation

`Mobile Native Validation` compiles Android debug APKs for arm64 devices and
x86_64 emulators, and an unsigned iOS simulator `.app`. It runs on mobile pull
requests, main pushes and manual dispatch, with 40-minute job limits and
commit-specific binary/build-log artifacts.

- Android: Node 22, JDK 17, Android SDK setup and the lockfile-generated
  Gradle wrapper. SDK 55 targets Android API 36.
- iOS: `macos-15` with `DEVELOPER_DIR` explicitly set to its installed
  Xcode 26.2, matching SDK 55's minimum. The runner's default Xcode 16.4
  is deliberately not used. CocoaPods resolves the generated native project;
  compilation sets `CODE_SIGNING_ALLOWED=NO` for the simulator.
- No EAS invocation, store signing, credentials, uploads to stores, or
  deployment is part of this workflow. GitHub Actions artifacts only.
- These are debug validation binaries, not release candidates. They require
  a local Metro development server for JavaScript and deliberately use a
  non-production API placeholder. The simulator app is not for physical iPhones.
- Successful compilation still does not prove device flows or store approval.

Toolchain references: [SDK 55 support table](https://docs.expo.dev/versions/v55.0.0/),
[Expo build infrastructure](https://docs.expo.dev/build-reference/infrastructure/),
[GitHub macOS 15 toolchains](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md).

## Release evidence is separate

The existing `EAS Mobile Build` workflow dispatches production builds with
`--no-wait` and can auto-submit iOS. Its green status means the dispatch was
accepted, **not** that builds completed or that a store approved the app.
Do not manually trigger it merely to validate this PR.

The [2026-10-09 workflow](https://github.com/BHDossantos/SavoryMind/actions/runs/37955884844)
logged these build/submission records:

- [Android build](https://expo.dev/accounts/brunodossantos707/projects/savorymind/builds/212081e1-a34e-472d-bd17-bdf739f63afa)
- [iOS build](https://expo.dev/accounts/brunodossantos707/projects/savorymind/builds/0041d330-5948-45eb-94a4-9bf236cb4b0c)
- [iOS submission](https://expo.dev/accounts/brunodossantos707/projects/savorymind/submissions/18792e4f-48bf-45b5-ba3e-83eff3b1689f)

Their terminal EAS/store states were not verified in this audit. No secrets
were read, created, or changed. Existing production automation is unchanged.
Review [open PR #130](https://github.com/BHDossantos/SavoryMind/pull/130)
carefully: its simplified `eas.json` removes existing store-specific settings,
including the simulator preview option and App Store app ID. This validation
change intentionally does not duplicate or merge that PR.

## Remaining launch gates

- [ ] Resolve the confirmed `npx expo install --check` failure, then run
  `npx expo-doctor`. The check reports 23 version mismatches, including
  `expo-localization@17.0.8` versus expected `~55.0.19`, React `19.2.5` versus
  expected `19.2.0`, and React Native `0.83.6` versus expected `0.83.10`.
  Treat this as an intentional dependency-alignment change with regression
  tests, not automatic bulk upgrades. Keep manifest and lockfile in sync.
- [ ] Remove stale `newArchEnabled: false` during the SDK configuration cleanup.
  Expo SDK 55 always uses the New Architecture and ignores this opt-out.
- [ ] Confirm terminal build/submission states in EAS and both store consoles
  for a candidate matching the latest approved commit.
- [ ] Run physical-device tests for login/refresh/logout, Apple/Google login,
  role switching, camera/menu scan, notifications, offline recovery,
  background/resume, localization, and accessibility.
- [ ] Review consumer Premium billing before paid distribution. The native
  `app/(consumer)/upgrade.js` opens Stripe Checkout for digital features.
  Determine allowed billing/link behavior per storefront, region, entitlement,
  and applicable program; do not assume the physical-food payment exception
  covers a digital subscription. Product/store approval is required before
  changing the business flow.
- [ ] Verify privacy disclosures, account deletion, permission prompts,
  production API/integrations, reviewer accounts, screenshots, and store forms.
- [ ] Repair the uptime monitor's issue-creation failure separately. A red
  monitor result alone is not proof the API is down; inspect probe logs.

References: [Expo CLI](https://docs.expo.dev/more/expo-cli/),
[Expo New Architecture](https://docs.expo.dev/guides/new-architecture/),
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/),
[Google Play payments](https://support.google.com/googleplay/android-developer/answer/9858738).
