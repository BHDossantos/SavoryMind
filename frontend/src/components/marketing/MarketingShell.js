/**
 * MarketingShell — shared header + footer for every public B2B marketing
 * page (the P0 repositioned site).
 *
 * Copy is HARDCODED (no react-i18next): these pages must ship their full
 * text in the server-rendered HTML so crawlers and AI answer engines see
 * real content, not translation keys. The tiny `STRINGS` dict below is
 * just a convenience to keep the IT/EN label pairs side by side — every
 * string is still a literal in this file.
 *
 * Props:
 *   lang    — "it" | "en" (default "it")
 *   altHref — URL of the same page in the other locale (IT ↔ EN switcher)
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

/**
 * Build a /signup href that preserves the visitor's attribution params
 * (utm_*, gclid, fbclid, ref) and appends ours (type, plan). Used by every
 * marketing CTA so `?plan=` + utm passthrough survives to the backend.
 */
export function signupHref(query = {}, extra = {}) {
  const params = new URLSearchParams();
  const PASS = /^(utm_|gclid$|fbclid$|ref$)/;
  Object.entries(query || {}).forEach(([k, v]) => {
    if (!PASS.test(k)) return;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) params.set(k, String(val));
  });
  Object.entries(extra).forEach(([k, v]) => {
    if (v != null) params.set(k, String(v));
  });
  const qs = params.toString();
  return `/signup${qs ? `?${qs}` : ""}`;
}

const STRINGS = {
  it: {
    nav: [
      { label: "Ristoranti", href: "/ristoranti" },
      { label: "Prezzi", href: "/pricing" },
      { label: "Come funziona", href: "/come-funziona" },
      { label: "Calcolatore spreco", href: "/calcolatore-spreco" },
      { label: "Case study", href: "/case-studies" },
      { label: "Contatti", href: "/contatti" },
    ],
    signIn: "Accedi",
    cta: "Inizia la prova gratuita",
    menuOpen: "Apri il menu",
    footerTagline:
      "Troviamo i €500–2.000 al mese che il tuo ristorante sta perdendo — e aiutiamo il tuo staff a fermarli.",
    colProduct: "Prodotto",
    colCompany: "Azienda",
    colLegal: "Legale",
    product: [
      { label: "Il prodotto per ristoranti", href: "/ristoranti" },
      { label: "Prezzi", href: "/pricing" },
      { label: "Come funziona", href: "/come-funziona" },
      { label: "Calcolatore spreco", href: "/calcolatore-spreco" },
      { label: "Case study", href: "/case-studies" },
    ],
    company: [
      { label: "Contatti", href: "/contatti" },
      { label: "Supporto", href: "/support" },
      { label: "Per chi ama il cibo", href: "/per-chi-ama-il-cibo" },
    ],
    legal: [
      { label: "Privacy (GDPR)", href: "/legal/privacy" },
      { label: "Termini di servizio", href: "/legal/terms" },
    ],
    language: "Lingua",
  },
  en: {
    nav: [
      { label: "Restaurants", href: "/ristoranti" },
      { label: "Pricing", href: "/en/pricing" },
      { label: "How it works", href: "/come-funziona" },
      { label: "Waste calculator", href: "/calcolatore-spreco" },
      { label: "Case studies", href: "/case-studies" },
      { label: "Contact", href: "/contatti" },
    ],
    signIn: "Sign in",
    cta: "Start your free trial",
    menuOpen: "Open menu",
    footerTagline:
      "We find the €500–2,000 a month your restaurant is losing — and help your team stop it.",
    colProduct: "Product",
    colCompany: "Company",
    colLegal: "Legal",
    product: [
      { label: "The product for restaurants", href: "/ristoranti" },
      { label: "Pricing", href: "/en/pricing" },
      { label: "How it works", href: "/come-funziona" },
      { label: "Waste calculator", href: "/calcolatore-spreco" },
      { label: "Case studies", href: "/case-studies" },
    ],
    company: [
      { label: "Contact", href: "/contatti" },
      { label: "Support", href: "/support" },
      { label: "For people who love food", href: "/per-chi-ama-il-cibo" },
    ],
    legal: [
      { label: "Privacy (GDPR)", href: "/legal/privacy" },
      { label: "Terms of service", href: "/legal/terms" },
    ],
    language: "Language",
  },
};

function LangSwitcher({ lang, altHref, className = "" }) {
  const other = lang === "it" ? "EN" : "IT";
  const self = lang === "it" ? "IT" : "EN";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${className}`}>
      <span className="px-2 py-1 rounded-md bg-brand-600 text-white">{self}</span>
      <Link
        href={altHref || (lang === "it" ? "/en" : "/")}
        className="px-2 py-1 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
      >
        {other}
      </Link>
    </span>
  );
}

export default function MarketingShell({ lang = "it", altHref, children }) {
  const s = STRINGS[lang] || STRINGS.it;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const trialHref = signupHref(router?.query, { type: "restaurant" });
  const homeHref = lang === "it" ? "/" : "/en";

  return (
    <div className="min-h-screen bg-white text-stone-900 antialiased">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 md:h-[4.5rem] flex items-center justify-between gap-4">
          <Link href={homeHref} className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl" aria-hidden="true">🧠</span>
            <span className="text-xl font-extrabold tracking-tight text-stone-900">
              Savory<span className="text-brand-600">Mind</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7" aria-label="principale">
            {s.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[15px] font-medium text-stone-600 hover:text-stone-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
            <LangSwitcher lang={lang} altHref={altHref} />
            <Link href="/login" className="text-[15px] font-medium text-stone-600 hover:text-stone-900">
              {s.signIn}
            </Link>
            <Link
              href={trialHref}
              className="bg-brand-600 hover:bg-brand-700 text-white text-[15px] font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              {s.cta}
            </Link>
          </div>

          {/* Mobile: switcher + hamburger */}
          <div className="flex lg:hidden items-center gap-3">
            <LangSwitcher lang={lang} altHref={altHref} />
            <button
              type="button"
              aria-label={s.menuOpen}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="w-10 h-10 flex flex-col items-center justify-center gap-[5px] rounded-lg border border-stone-200"
            >
              <span className={`block w-5 h-0.5 bg-stone-800 transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`} />
              <span className={`block w-5 h-0.5 bg-stone-800 ${open ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-0.5 bg-stone-800 transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
            </button>
          </div>
        </div>

        {open && (
          <nav className="lg:hidden border-t border-stone-100 bg-white px-5 py-4 space-y-1" aria-label="principale mobile">
            {s.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-base font-medium text-stone-700 hover:bg-stone-50"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-base font-medium text-stone-700 hover:bg-stone-50">
              {s.signIn}
            </Link>
            <Link
              href={trialHref}
              onClick={() => setOpen(false)}
              className="block text-center bg-brand-600 text-white font-bold px-4 py-3 rounded-xl mt-2"
            >
              {s.cta}
            </Link>
          </nav>
        )}
      </header>

      <main>{children}</main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-stone-950 text-stone-300 mt-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl" aria-hidden="true">🧠</span>
                <span className="text-lg font-extrabold text-white">
                  Savory<span className="text-brand-400">Mind</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed text-stone-400 max-w-xs">{s.footerTagline}</p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4">{s.colProduct}</h3>
              <ul className="space-y-2.5">
                {s.product.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-stone-300 hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4">{s.colCompany}</h3>
              <ul className="space-y-2.5">
                {s.company.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-stone-300 hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-4">{s.colLegal}</h3>
              <ul className="space-y-2.5">
                {s.legal.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-stone-300 hover:text-white transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">{s.language}</h3>
                <LangSwitcher lang={lang} altHref={altHref} />
              </div>
            </div>
          </div>

          <div className="border-t border-stone-800 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
            {/* TODO(Bruno): replace with the real P.IVA once registered */}
            <p>© {new Date().getFullYear()} SavoryMind · P.IVA 00000000000</p>
            <p className="font-semibold text-stone-400">Made in Rome 🇮🇹</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
