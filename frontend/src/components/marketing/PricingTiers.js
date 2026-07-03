/**
 * PricingTiers — the three B2B tiers + annual toggle + guarantee box.
 * Shared by the homepage pricing section and /pricing (both locales) so
 * the numbers can never drift apart.
 *
 * Copy is hardcoded (IT/EN dict below) — no i18n lib, full text in the
 * server-rendered HTML. The annual toggle is the only client state.
 *
 * Tiers (DEVELOPER_NOTES §1/§8.1): Trattoria €149/mo, Ristorante €299/mo,
 * Gruppo €599/mo. Annual = 10× monthly (2 months free) → shown per month
 * as €124 / €249 / €499, billed yearly.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { signupHref } from "./MarketingShell";

export const TIERS = [
  {
    id: "trattoria",
    name: "Trattoria",
    monthly: 149,
    annualMonthly: 124,
    annualTotal: 1490,
  },
  {
    id: "ristorante",
    name: "Ristorante",
    monthly: 299,
    annualMonthly: 249,
    annualTotal: 2990,
    featured: true,
  },
  {
    id: "gruppo",
    name: "Gruppo",
    monthly: 599,
    annualMonthly: 499,
    annualTotal: 5990,
  },
];

const STRINGS = {
  it: {
    monthly: "Mensile",
    annual: "Annuale",
    annualBonus: "2 mesi gratis",
    perMonth: "/mese",
    billedAnnually: (total) => `fatturati €${total.toLocaleString("it-IT")} l'anno`,
    billedMonthly: "nessun vincolo, disdici quando vuoi",
    cta: "Inizia la prova gratuita",
    featured: "Il più scelto",
    taglines: {
      trattoria: "Per la singola cucina che vuole vedere subito dove finiscono i soldi.",
      ristorante: "Per chi fa sul serio: coaching senza limiti e consegna su WhatsApp.",
      gruppo: "Per chi gestisce più insegne e vuole i numeri di tutte in un posto solo.",
    },
    features: {
      trattoria: [
        "1 sede",
        "Moduli core: Dashboard, Perdite & Sprechi, Menu & Margini",
        "Coaching per 10 dipendenti",
        "Stima delle perdite in 15 minuti",
        "Import vendite CSV/Excel da qualsiasi gestionale",
      ],
      ristorante: [
        "Tutto di Trattoria",
        "Moduli avanzati sbloccati (prenotazioni, CRM, sentiment, marketing)",
        "Coaching illimitato per tutto lo staff",
        "Piani di coaching consegnati su WhatsApp",
        "Report settimanale del titolare",
      ],
      gruppo: [
        "Tutto di Ristorante",
        "Multi-sede con confronto tra locali",
        "Onboarding dedicato con un esperto",
        "Supporto prioritario",
        "Report consolidato di gruppo",
      ],
    },
    guaranteeTitle: "La garanzia SavoryMind",
    guaranteeBody:
      "Provi tutto gratis per 30 giorni. Se non troviamo almeno €500/mese di perdite recuperabili, non paghi. E se la tua cucina è già efficiente, te lo diciamo onestamente — nessun numero gonfiato, mai.",
    trialNote: "30 giorni di prova gratuita su tutti i piani · carta non richiesta all'inizio",
  },
  en: {
    monthly: "Monthly",
    annual: "Annual",
    annualBonus: "2 months free",
    perMonth: "/month",
    billedAnnually: (total) => `billed €${total.toLocaleString("en-US")} per year`,
    billedMonthly: "no lock-in, cancel anytime",
    cta: "Start your free trial",
    featured: "Most popular",
    taglines: {
      trattoria: "For the single kitchen that wants to see where the money goes — now.",
      ristorante: "For owners who mean it: unlimited coaching, delivered on WhatsApp.",
      gruppo: "For groups running multiple venues that want every number in one place.",
    },
    features: {
      trattoria: [
        "1 location",
        "Core modules: Dashboard, Losses & Waste, Menu & Margins",
        "Coaching for 10 employees",
        "Loss estimate in 15 minutes",
        "CSV/Excel sales import from any POS",
      ],
      ristorante: [
        "Everything in Trattoria",
        "Advanced modules unlocked (bookings, CRM, sentiment, marketing)",
        "Unlimited coaching for your whole staff",
        "Coaching plans delivered on WhatsApp",
        "Weekly owner report",
      ],
      gruppo: [
        "Everything in Ristorante",
        "Multi-location with venue comparison",
        "Dedicated onboarding with an expert",
        "Priority support",
        "Consolidated group report",
      ],
    },
    guaranteeTitle: "The SavoryMind guarantee",
    guaranteeBody:
      "Try everything free for 30 days. If we don't identify at least €500/month in recoverable losses, you don't pay. And if your kitchen is already efficient, we'll tell you honestly — no inflated numbers, ever.",
    trialNote: "30-day free trial on every plan · no card required to start",
  },
};

export default function PricingTiers({ lang = "it", showFeatures = true }) {
  const s = STRINGS[lang] || STRINGS.it;
  const router = useRouter();
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Monthly / annual toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          aria-pressed={!annual}
          className={`px-4 py-2 rounded-xl text-[15px] font-bold transition-colors ${
            !annual ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          {s.monthly}
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          aria-pressed={annual}
          className={`px-4 py-2 rounded-xl text-[15px] font-bold transition-colors inline-flex items-center gap-2 ${
            annual ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          {s.annual}
          <span className="text-[11px] font-extrabold uppercase tracking-wide bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">
            {s.annualBonus}
          </span>
        </button>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {TIERS.map((tier) => {
          const price = annual ? tier.annualMonthly : tier.monthly;
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-3xl p-7 ${
                tier.featured
                  ? "bg-stone-950 text-white shadow-2xl shadow-brand-200 border border-stone-900 md:-my-3 md:py-10"
                  : "bg-white border border-stone-200 shadow-sm"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-extrabold uppercase tracking-wide rounded-full px-4 py-1.5">
                  {s.featured}
                </span>
              )}
              <h3 className={`text-xl font-extrabold ${tier.featured ? "text-white" : "text-stone-900"}`}>
                {tier.name}
              </h3>
              <p className={`text-sm mt-1.5 leading-relaxed ${tier.featured ? "text-stone-300" : "text-stone-500"}`}>
                {s.taglines[tier.id]}
              </p>

              <p className="mt-6 flex items-baseline gap-1.5">
                <span className={`text-4xl font-extrabold tracking-tight tabular-nums ${tier.featured ? "text-white" : "text-stone-900"}`}>
                  €{price}
                </span>
                <span className={`text-base font-semibold ${tier.featured ? "text-stone-400" : "text-stone-500"}`}>
                  {s.perMonth}
                </span>
              </p>
              <p className={`text-xs mt-1 ${tier.featured ? "text-stone-400" : "text-stone-400"}`}>
                {annual ? s.billedAnnually(tier.annualTotal) : s.billedMonthly}
              </p>

              {showFeatures && (
                <ul className="mt-6 space-y-2.5 flex-1">
                  {s.features[tier.id].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span
                        aria-hidden="true"
                        className={`mt-1 text-sm font-black ${tier.featured ? "text-brand-400" : "text-brand-600"}`}
                      >
                        ✓
                      </span>
                      <span className={`text-[15px] leading-snug ${tier.featured ? "text-stone-200" : "text-stone-700"}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={signupHref(router?.query, { type: "restaurant", plan: tier.id })}
                className={`mt-7 block text-center font-bold text-base px-5 py-3.5 rounded-2xl transition-colors ${
                  tier.featured
                    ? "bg-brand-500 hover:bg-brand-400 text-white"
                    : "bg-brand-600 hover:bg-brand-700 text-white"
                }`}
              >
                {s.cta}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Guarantee box */}
      <div className="mt-10 rounded-3xl border-2 border-brand-200 bg-brand-50 px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row items-start gap-4">
        <span className="text-3xl flex-shrink-0" aria-hidden="true">🤝</span>
        <div>
          <h3 className="text-lg font-extrabold text-stone-900">{s.guaranteeTitle}</h3>
          <p className="text-base text-stone-700 leading-relaxed mt-1.5">{s.guaranteeBody}</p>
          <p className="text-sm font-semibold text-brand-700 mt-3">{s.trialNote}</p>
        </div>
      </div>
    </div>
  );
}
