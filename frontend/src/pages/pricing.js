/**
 * /pricing — B2B tiers page (Italian primary; /en/pricing mirror).
 * Copy hardcoded in the JSX (no i18n lib) for crawlable HTML.
 * JSON-LD: SoftwareApplication with the three EUR offers (§2.2).
 */
import Head from "next/head";
import Link from "next/link";
import MarketingShell from "../components/marketing/MarketingShell";
import PricingTiers, { TIERS } from "../components/marketing/PricingTiers";

const FAQS = [
  {
    q: "Come funziona la prova gratuita di 30 giorni?",
    a: "Ti registri, colleghi i tuoi dati (o fai l'audit guidato di 15 minuti) e usi tutto il prodotto per 30 giorni. La carta non è richiesta all'inizio. Se non troviamo almeno €500/mese di perdite recuperabili, non paghi nulla.",
  },
  {
    q: "Cosa conta come «sede»?",
    a: "Un punto vendita con la propria cucina e il proprio staff. Se gestisci più insegne o più locali della stessa insegna, il piano Gruppo li riunisce in un'unica dashboard con confronto tra sedi.",
  },
  {
    q: "Posso cambiare piano in seguito?",
    a: "Sì, in qualsiasi momento. Il passaggio a un piano superiore è immediato; il passaggio a un piano inferiore ha effetto dal periodo di fatturazione successivo.",
  },
  {
    q: "Posso disdire quando voglio?",
    a: "Sì, dalla sezione fatturazione, senza penali e con effetto a fine periodo. Con il piano annuale hai comunque 2 mesi gratis rispetto al mensile.",
  },
  {
    q: "È compatibile con il mio gestionale o POS?",
    a: "Sì. Puoi caricare un export vendite in CSV o Excel da qualsiasi gestionale, oppure iniziare senza dati con l'audit guidato. Le integrazioni dirette con i POS italiani più diffusi sono in sviluppo.",
  },
];

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SavoryMind",
  url: "https://savorymind.net/pricing",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "SavoryMind trova le perdite economiche dei ristoranti — sprechi, porzioni, tempi dello staff — e genera piani di coaching personalizzati per fermarle.",
  offers: TIERS.map((t) => ({
    "@type": "Offer",
    name: t.name,
    price: String(t.monthly),
    priceCurrency: "EUR",
    url: "https://savorymind.net/pricing",
    category: "subscription",
  })),
};

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PricingIT() {
  return (
    <MarketingShell lang="it" altHref="/en/pricing">
      <Head>
        <title>Prezzi — SavoryMind per ristoranti | Da €149/mese</title>
        <meta
          name="description"
          content="Trattoria €149/mese, Ristorante €299/mese, Gruppo €599/mese. 30 giorni di prova gratuita: se non troviamo €500/mese di perdite, non paghi."
        />
        <link rel="canonical" href="https://savorymind.net/pricing" />
        <link rel="alternate" hrefLang="it-IT" href="https://savorymind.net/pricing" />
        <link rel="alternate" hrefLang="en-US" href="https://savorymind.net/en/pricing" />
        <link rel="alternate" hrefLang="x-default" href="https://savorymind.net/pricing" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:url" content="https://savorymind.net/pricing" />
        <meta property="og:title" content="Prezzi — SavoryMind per ristoranti" />
        <meta
          property="og:description"
          content="Tre piani chiari, prova gratuita di 30 giorni e una garanzia onesta: se non troviamo €500/mese di perdite recuperabili, non paghi."
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Prezzi — SavoryMind per ristoranti" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
        />
      </Head>

      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-14 pb-6 md:pt-20 md:pb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Prezzi</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Un prezzo chiaro. Un risultato in euro.
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-5">
            Ogni piano include la stima delle perdite in 15 minuti e i piani di coaching per il tuo
            staff. Scegli in base alla dimensione della tua cucina — e cambia quando vuoi.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 sm:px-6 pb-16 md:pb-24 pt-6">
        <PricingTiers lang="it" />
      </section>

      {/* FAQ */}
      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 md:py-20">
          <h2 className="font-serif text-3xl font-bold text-stone-900 text-center mb-10">
            Domande sui piani
          </h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group bg-white border border-stone-200 rounded-2xl px-6 py-5 open:shadow-md transition-shadow">
                <summary className="flex items-start justify-between gap-4 cursor-pointer list-none text-lg font-bold text-stone-900 leading-snug">
                  {f.q}
                  <span className="text-brand-600 text-xl leading-none mt-0.5 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="text-base text-stone-600 leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="text-center text-base text-stone-500 mt-10">
            Altre domande?{" "}
            <Link href="/contatti" className="font-bold text-brand-700 hover:text-brand-600">
              Scrivici, rispondiamo in giornata →
            </Link>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}

PricingIT.bareLayout = true;
