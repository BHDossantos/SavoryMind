# Mobile compatibility audit — 15 November 2026

Store readiness remains BLOCKED. No release, store upload, merge, provider configuration or credentials were changed.

The mobile manifest combined Expo58 with Expo55 modules and React Native0.83. Clean installation succeeded but all24 mobile suites initially failed before tests ran because the incompatible Jest preset could not resolve expo-modules-core. Align native modules with Expo58's bundled compatibility recommendations, React19.3 / React Native0.88, Babel/Jest presets and the router's testing-library peer. Pin react-dom to the same React version so optional web peers cannot silently choose an incompatible patch. Regenerate the lockfile without force/legacy peer overrides. Remove ignored newArchEnabled:false (SDK55+ cannot disable the new architecture).

Testing Library14 renders/events are async. Existing assertions are retained with awaited renders/events, effect-based focus mocks, and direct accessible social-login button queries instead of removed UNSAFE component queries. Social buttons now expose provider names and button roles to assistive technology. Purchase handlers intentionally start their internally caught async operations without returning the pending store promise; the account-switch regression still verifies stale completion cannot update a different account.

Validation: clean npm ci passed; offline Expo compatibility check passed; all125 tests/24 suites passed. Validation evidence is recorded in the portfolio audit handoff. Both iOS and Android Metro bundles were exported; those are JavaScript/assets only, not compiled/signed native binaries. A fresh native build is required; do not ship this runtime upgrade as an OTA update to an older binary.

## Remaining gates

- Obtain matching Android/iOS native build artifacts, verify target API36 and Xcode26/iOS26 SDK, and test physical devices.
- Verify developer accounts, signing and app record ownership, screenshots, age ratings and privacy/Data Safety forms.
- Validate camera/photo denial, AI data-sharing consent, auth/deep-link returns, notifications, accessibility, offline recovery and production API reachability.
- Verify real sandbox purchase/restore/refund/renewal/account switching and deletion fulfillment across databases/providers/backups. Earlier release documentation's prerequisites remain open until evidenced.
- Production URLs were inaccessible from this audit environment's proxy; local web/mobile fixture results do not establish deployed behavior.

References: https://docs.expo.dev/versions/v58.0.0/ ; https://docs.expo.dev/guides/new-architecture/ ; https://developer.apple.com/news/upcoming-requirements/ ; https://support.google.com/googleplay/android-developer/answer/11926878
