/**
 * Web i18n bootstrap.
 *
 * Mirrors mobile/services/i18n.js — same five supported languages, same
 * key namespace conventions, same storage pattern. A user who picks
 * Portuguese on web sees Portuguese on a fresh mobile install too,
 * because both clients PATCH the language onto the user record and
 * applyServerLanguage() reads it on hydrate.
 *
 * Client-side only: i18n.use(initReactI18next).init() runs once when
 * this module is imported by _app.js. Translations are bundled (not
 * lazy-loaded) so the very first render uses the right locale — same
 * tradeoff mobile makes, and the bundle stays small enough (~30KB
 * across 5 languages combined for the v1 string set) that it's worth
 * the simplicity.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "../locales/en.json";
import es from "../locales/es.json";
import it from "../locales/it.json";
import pt from "../locales/pt.json";
import fr from "../locales/fr.json";

export const SUPPORTED_LANGUAGES = ["en", "es", "it", "pt", "fr"];
const DEFAULT_LANGUAGE = "en";
const STORAGE_KEY = "savorymind.language";

function normalize(code) {
  if (!code) return DEFAULT_LANGUAGE;
  const short = String(code).toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
}

// Build the resources map once. react-i18next reads keys lazily so
// shipping the full bundle costs nothing at runtime beyond the parse.
const resources = {
  en: { translation: en },
  es: { translation: es },
  it: { translation: it },
  pt: { translation: pt },
  fr: { translation: fr },
};

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      interpolation: { escapeValue: false },
      detection: {
        // Order matters: a logged-in user's choice (in localStorage)
        // wins over browser locale on every page load.
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: STORAGE_KEY,
      },
      react: { useSuspense: false },
    });
}

/**
 * Flip the active language. Persists to localStorage and optionally
 * PATCHes the user profile (when the user is logged in) so Flavor +
 * recommendations respond in the new language on the next call, and
 * mobile picks up the change on next hydrate.
 */
export async function setLanguage(code, { syncToServer } = {}) {
  const next = normalize(code);
  if (next !== i18n.language) {
    await i18n.changeLanguage(next);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode etc. — best effort.
  }
  if (syncToServer) {
    try {
      await syncToServer({ language: next });
    } catch {
      // Network failure: the local switch still holds.
    }
  }
  return next;
}

/**
 * Apply server-stored language preference. Called by AuthContext on
 * hydrate so the server-side preference wins over browser locale for
 * logged-in users.
 */
export async function applyServerLanguage(code) {
  const next = normalize(code);
  if (next !== i18n.language) {
    await i18n.changeLanguage(next);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // best-effort
  }
}

export default i18n;
