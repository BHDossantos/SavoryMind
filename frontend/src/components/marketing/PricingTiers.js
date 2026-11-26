/**
 * PricingTiers — the SavoryMind plan, the founding offer and the guarantee box.
 * Shared by the homepage pricing section and /pricing (both locales) so
 * the numbers can never drift apart.
 *
 * Copy is hardcoded (IT/EN dict below) — no i18n lib, full text in the
 * server-rendered HTML. The annual toggle is the only client state.
 *
 * Price approved by Bruno on 26 Nov 2026 (Launch-to-cash playbook):
 *   - €69/month or €690/year for the booking tool, no commission on the
 *     restaurant's own diners;
 *   - €2 per seated party, only for diners SavoryMind brings;
 *   - founding offer for the first 10 Rome restaurants until 31 Dec:
 *     January to March for €149 upfront, or a full year for €590 upfront,
 *     price locked, money back if bookings aren't live on 1 January.
 * TIERS keeps its old shape so the JSON-LD offers on /pricing and
 * /ristoranti keep working.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { signupHref } from "./MarketingShell";

export const TIERS = [
  {
    id: "savorymind",
    name: "SavoryMind",
    monthly: 69,
    annualMonthly: 57.5,
    annualTotal: 690,
  },
];

export const PER_PARTY_FEE = 2;

export const FOUNDING = {
  spots: 10,
  quarterPrice: 149,
  yearPrice: 590,
};

const STRINGS = {
  it: {
    monthly: "Mensile",
    annual: "Annuale",
    annualBonus: "2 mesi gratis",
    perMonth: "/mese",
    billedAnnually: (total) => `fatturati €${total.toLocaleString("it-IT")} l'anno`,
    billedMonthly: "nessun vincolo, disdici quando vuoi",
    cta: "Inizia la prova gratuita",
    tagline: "Prenotazioni, clienti e numeri del tuo locale in un posto solo, senza commissioni sui tuoi clienti.",
    perParty: (fee) =>
      `Zero commissioni sui clienti che prenotano dal tuo sito, da Google o da Instagram. Paghi €${fee} a tavolo seduto solo per i clienti che ti porta SavoryMind. Mai sui no-show o sulle cancellazioni.`,
    features: [
      "Prenotazioni online con pagina e link del tuo locale",
      "Zero commissioni sui tuoi clienti",
      "Promemoria agli ospiti e stato del tavolo condiviso con la sala",
      "Perdite & sprechi, menu e margini",
      "Sentiment delle recensioni e report settimanale del titolare",
      "Import vendite CSV/Excel da qualsiasi gestionale",
    ],
    compare:
      "Per confronto: le grandi piattaforme di prenotazione fanno pagare una commissione per ogni persona che ti portano. Con SavoryMind i €2 valgono per l'intero tavolo, e solo quando il cliente te lo portiamo noi.",
    foundingBadge: (n) => `Ristoranti fondatori · solo i primi ${n}`,
    foundingTitle: "Offerta fondatori, fino al 31 dicembre",
    foundingQuarter: (p) => `€${p} per gennaio, febbraio e marzo, pagati in anticipo`,
    foundingYear: (p) => `oppure €${p} per un anno intero`,
    foundingBody:
      "Prezzo bloccato. Se le prenotazioni non sono attive nel tuo locale il 1° gennaio, ti restituiamo tutto.",
    foundingCta: "Prenota una demo",
    guaranteeTitle: "La garanzia SavoryMind",
    guaranteeBody:
      "Provi tutto gratis per 30 giorni. Se non troviamo almeno €500/mese di perdite recuperabili, non paghi. E se la tua cucina è già efficiente, te lo diciamo onestamente — nessun numero gonfiato, mai.",
    trialNote: "30 giorni di prova gratuita sul piano mensile · carta non richiesta all'inizio",
  },
  en: {
    monthly: "Monthly",
    annual: "Annual",
    annualBonus: "2 months free",
    perMonth: "/month",
    billedAnnually: (total) => `billed €${total.toLocaleString("en-US")} per year`,
    billedMonthly: "no lock-in, cancel anytime",
    cta: "Start your free trial",
    tagline: "Bookings, guests and your venue's numbers in one place, with no commission on your own diners.",
    perParty: (fee) =>
      `No commission on diners who book from your website, Google or Instagram. You pay €${fee} per seated party only for diners SavoryMind brings you. Never on no-shows or cancellations.`,
    features: [
      "Online bookings with your venue's own page and link",
      "No commission on your own diners",
      "Guest reminders and table status shared with your floor team",
      "Losses & waste, menu and margins",
      "Review sentiment and a weekly owner report",
      "CSV/Excel sales import from any POS",
    ],
    compare:
      "For comparison: the big booking platforms charge a fee for every person they bring you. With SavoryMind the €2 covers the whole table, and only when we brought you the diner.",
    foundingBadge: (n) => `Founding restaurants · first ${n} only`,
    foundingTitle: "Founding offer, until 31 December",
    foundingQuarter: (p) => `€${p} for January, February and March, paid upfront`,
    foundingYear: (p) => `or €${p} for a full year`,
    foundingBody:
      "Price locked. If bookings aren't live at your venue on 1 January, you get all of it back.",
    foundingCta: "Book a demo",
    guaranteeTitle: "The SavoryMind guarantee",
    guaranteeBody:
      "Try everything free for 30 days. If we don't identify at least €500/month in recoverable losses, you don't pay. And if your kitchen is already efficient, we'll tell you honestly — no inflated numbers, ever.",
    trialNote: "30-day free trial on the monthly plan · no card required to start",
  },
};

function formatPrice(n, lang) {
  return Number.isInteger(n)
    ? String(n)
    : n.toLocaleString(lang === "en" ? "en-US" : "it-IT", { minimumFractionDigits: 2 });
}

export default function PricingTiers({ lang = "it", showFeatures = true }) {
  const s = STRINGS[lang] || STRINGS.it;
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const tier = TIERS[0];
  const price = annual ? tier.annualMonthly : tier.monthly;
  const demoHref = "/contatti";

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* The plan */}
        <div className="relative flex flex-col rounded-3xl p-7 bg-white border border-stone-200 shadow-sm">
          <h3 className="text-xl font-extrabold text-stone-900">{tier.name}</h3>
          <p className="text-sm mt-1.5 leading-relaxed text-stone-500">{s.tagline}</p>

          <p className="mt-6 flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold tracking-tight tabular-nums text-stone-900">
              €{formatPrice(price, lang)}
            </span>
            <span className="text-base font-semibold text-stone-500">{s.perMonth}</span>
          </p>
          <p className="text-xs mt-1 text-stone-400">
            {annual ? s.billedAnnually(tier.annualTotal) : s.billedMonthly}
          </p>
          <p className="text-sm mt-4 leading-relaxed text-stone-700">{s.perParty(PER_PARTY_FEE)}</p>

          {showFeatures && (
            <ul className="mt-6 space-y-2.5 flex-1">
              {s.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-1 text-sm font-black text-brand-600">
                    ✓
                  </span>
                  <span className="text-[15px] leading-snug text-stone-700">{f}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={signupHref(router?.query, { type: "restaurant", plan: tier.id })}
            className="mt-7 block text-center font-bold text-base px-5 py-3.5 rounded-2xl transition-colors bg-brand-600 hover:bg-brand-700 text-white"
          >
            {s.cta}
          </Link>
        </div>

        {/* Founding offer */}
        <div className="relative flex flex-col rounded-3xl p-7 bg-stone-950 text-white shadow-2xl shadow-brand-200 border border-stone-900">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-brand-500 text-white text-xs font-extrabold uppercase tracking-wide rounded-full px-4 py-1.5">
            {s.foundingBadge(FOUNDING.spots)}
          </span>
          <h3 className="text-xl font-extrabold text-white">{s.foundingTitle}</h3>
          <p className="mt-6 text-2xl font-extrabold tracking-tight text-white">
            {s.foundingQuarter(FOUNDING.quarterPrice)}
          </p>
          <p className="mt-1 text-base font-semibold text-stone-300">{s.foundingYear(FOUNDING.yearPrice)}</p>
          <p className="mt-4 text-[15px] leading-relaxed text-stone-200 flex-1">{s.foundingBody}</p>
          <Link
            href={demoHref}
            className="mt-7 block text-center font-bold text-base px-5 py-3.5 rounded-2xl transition-colors bg-brand-500 hover:bg-brand-400 text-white"
          >
            {s.foundingCta}
          </Link>
        </div>
      </div>

      <p className="mt-6 text-sm text-stone-500 leading-relaxed text-center max-w-3xl mx-auto">{s.compare}</p>

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
