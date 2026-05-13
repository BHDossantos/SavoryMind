// Jest setup — runs before every test file.
//
// expo-secure-store is replaced via moduleNameMapper (see package.json
// jest config) so the test process doesn't need the real Expo native
// modules installed. EXPO_PUBLIC_API_URL is set here so api.js, which
// reads it at import time, sees a recognisable host in test assertions.
process.env.EXPO_PUBLIC_API_URL = 'http://test-backend';

// Default fetch stub. Individual tests override with jest.fn() returning
// specific responses; this fallback keeps any uncovered call from
// throwing a NetworkError that masks the real assertion.
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Boot i18next with the bundled English resources so screens rendered
// in tests get translated strings instead of key fallbacks ("auth.email"
// → "Email"). Side-effect import — the file initialises i18n at import
// time. Mirrors what app/_layout.js triggers in production.
require('./services/i18n');
