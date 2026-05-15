import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { setLanguage, SUPPORTED_LANGUAGES } from "../services/i18n";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

const FLAG = {
  en: "🇬🇧",
  es: "🇪🇸",
  it: "🇮🇹",
  pt: "🇵🇹",
  fr: "🇫🇷",
};

/**
 * Tiny dropdown for the language switcher. Lives in the top-right of
 * every shell (Layout / ConsumerLayout / DinerLayout) and on the public
 * landing page so an unauthenticated visitor can browse in their own
 * language before deciding to sign up.
 */
export default function LanguageSelector({ compact = false }) {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth() || {};
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Click-outside to close. Touch + mouse share the same listener; the
  // capture-phase handler avoids being swallowed by clicks inside the
  // panel itself.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = i18n.language?.split("-")[0] || "en";

  const pick = async (code) => {
    setOpen(false);
    if (code === current) return;
    await setLanguage(code, {
      // Only sync to server if a user is logged in — calling the auth
      // profile endpoint without a session would 401.
      syncToServer: user ? (payload) => api.updateAuthProfile(payload) : undefined,
    });
    // Reflect the change in auth context so dependent components re-render.
    if (user && setUser) {
      setUser((u) => ({ ...u, language: code }));
    }
  };

  const languageNames = t("common.languageNames", { returnObjects: true }) || {};

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors " +
          (compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm")
        }
        title={t("languageSelector.tooltip")}
        aria-label={t("languageSelector.tooltip")}
      >
        <span>{FLAG[current] || "🌐"}</span>
        {!compact && <span className="text-gray-700 font-medium uppercase">{current}</span>}
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
          {SUPPORTED_LANGUAGES.map((code) => (
            <button
              key={code}
              onClick={() => pick(code)}
              className={
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left " +
                (code === current ? "bg-gray-50 font-semibold" : "")
              }
            >
              <span className="text-base">{FLAG[code]}</span>
              <span className="flex-1 text-gray-700">{languageNames[code] || code}</span>
              {code === current && <span className="text-brand-600">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
