/**
 * i18n bootstrap for the mobile app.
 *
 * - Reads device locale via expo-localization on first launch.
 * - Persists user's chosen language in SecureStore (no backend round-trip
 *   on cold start — the saved preference is read synchronously after the
 *   first async load).
 * - When the user signs in, AuthContext calls applyServerLanguage(user.language)
 *   so the server-stored preference wins over the device default.
 * - When the user picks a language in Profile, setLanguage() flips the
 *   active locale, persists it locally, and (if logged in) PATCHes the
 *   profile so Flavor / recommendations / etc. respond in the right
 *   language across both web and mobile.
 *
 * Supported set is intentionally small (en/es/it) — same set the backend
 * validates in ProfileUpdate.validate_language(). Anything else falls
 * back to English.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import en from '../locales/en.json';
import es from '../locales/es.json';
import it from '../locales/it.json';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'it'];
const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'savorymind.language';

function normalize(code) {
  if (!code) return DEFAULT_LANGUAGE;
  const short = String(code).toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
}

function detectDeviceLanguage() {
  try {
    // Expo SDK 55: getLocales() returns [{ languageCode, languageTag, ... }, ...]
    const locales = Localization.getLocales?.() || [];
    return normalize(locales[0]?.languageCode || locales[0]?.languageTag);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

// Synchronous init — starts with device language so the very first
// render uses a sensible locale. The stored preference (if any) is
// applied right after, in initI18n().
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    it: { translation: it },
  },
  lng: detectDeviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  // RN doesn't have Suspense for i18n loading; resources are bundled.
  react: { useSuspense: false },
});

/**
 * Read the stored preference and apply it. Call once at app startup,
 * before any screens render strings.
 */
export async function initI18n() {
  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // SecureStore unavailable (rare); leave the device-detected locale active.
  }
}

/**
 * Switch the active language. Persists locally + (if `syncToServer` is
 * passed an api object) PATCHes the user's profile so Flavor speaks
 * the right language on the next AI call.
 *
 * Returns the normalised language code that was actually applied.
 */
export async function setLanguage(code, { syncToServer } = {}) {
  const next = normalize(code);
  if (next !== i18n.language) {
    await i18n.changeLanguage(next);
  }
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, next);
  } catch {
    // Persistence is best-effort — if it fails the language still
    // applies for the current session.
  }
  if (syncToServer) {
    try {
      await syncToServer({ language: next });
    } catch {
      // Network failure: the local switch still holds. Next login refresh
      // will re-sync (or we'll retry on next save).
    }
  }
  return next;
}

/**
 * Called by AuthContext right after sign-in / hydrate. The server-stored
 * language wins over the device-detected one — that way a user who set
 * Spanish on web sees Spanish on a fresh mobile install too.
 */
export async function applyServerLanguage(code) {
  const next = normalize(code);
  if (next !== i18n.language) {
    await i18n.changeLanguage(next);
  }
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, next);
  } catch {
    // best-effort
  }
}

export default i18n;
