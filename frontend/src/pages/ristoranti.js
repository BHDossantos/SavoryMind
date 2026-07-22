/**
 * /ristoranti — product deep-dive for restaurant owners (IT only for now,
 * DEVELOPER_NOTES §3.1). The six visible modules as descriptive sections,
 * the Carlos component reused, CTA. Copy hardcoded for crawlable HTML.
 * JSON-LD: SoftwareApplication.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import MarketingShell, { signupHref } from "../components/marketing/MarketingShell";
import CarlosCard, { DEMO_PLAN } from "../components/marketing/CarlosCard";
import { TIERS } from "../components/marketing/PricingTiers";

const MODULES = [
  {
    icon: "📊",
    title: "Dashboard",
    lead: "Il primo numero della giornata: quanto stai perdendo, quanto hai recuperato.",
    body:
      "Apri SavoryMind e vedi subito due cifre: la stima delle perdite mensili della tua cucina e i soldi recuperati da quando hai iniziato. Sotto, l'andamento settimana per settimana. Niente grafici da interpretare: euro, chiari, aggiornati.",
    points: [
      "Stima delle perdite mensili con fascia di confidenza — mai numeri gonfiati",
      "Contatore del recuperato: la prova, in euro, che il coaching funziona",
      "Pensata per il telefono: la controlli in 30 secondi tra un servizio e l'altro",
    ],
  },
  {
    icon: "🗑️",
    title: "Perdite & Sprechi",
    lead: "Ogni chilo buttato ha un costo. Qui lo vedi, con la causa accanto.",
    body:
      "Il tuo staff registra un episodio di spreco in 20 secondi, dalla cucina, durante il servizio: chi, cosa, quanto. SavoryMind lo traduce in euro, lo collega a una causa (porzioni, cottura, conservazione, prep) e lo somma al quadro mensile. L'inventario è integrato: scarichi, consegne e conte parlano tra loro.",
    points: [
      "Registrazione rapida a grandi pulsanti, pensata per le mani in servizio",
      "Ogni episodio ha costo in euro, quantità e causa — mai «spreco generico»",
      "Inventario incluso: registro contabile di scarichi, consegne e conte",
    ],
  },
  {
    icon: "🎓",
    title: "Coaching Staff",
    lead: "Il cuore di SavoryMind: piani personalizzati, costruttivi, in euro.",
    body:
      "Per ogni persona del tuo staff, SavoryMind mette insieme gli episodi degli ultimi 30 giorni e genera un piano di coaching: cosa sta costando, perché, e 3–5 azioni concrete per sistemarlo. Tu rivedi e approvi ogni piano prima che parta. Il tono è sempre rispettoso: si correggono i processi, mai le persone.",
    points: [
      "Ogni cifra nel piano è tracciabile a episodi reali — niente numeri inventati",
      "Consegna su WhatsApp: lo staff non deve installare né aprire nulla di nuovo",
      "Piani anche in inglese e spagnolo per le cucine multilingue",
    ],
  },
  {
    icon: "🍝",
    title: "Menu & Margini",
    lead: "Quali piatti ti fanno guadagnare e quali ti costano — davvero.",
    body:
      "Il piatto che vende di più non è sempre quello che rende di più. SavoryMind incrocia vendite, costi e porzioni per dirti dove il margine si assottiglia: porzioni cresciute nel tempo, prezzi fermi da due anni, piatti che occupano la cucina e rendono poco.",
    points: [
      "Margine per piatto, non solo fatturato",
      "Segnalazione dei piatti dove la porzione servita ha superato la ricetta",
      "Tendenze di vendita per stagione e giorno della settimana",
    ],
  },
  {
    icon: "🔮",
    title: "AI Predictions",
    lead: "Sapere cosa succede stasera, prima che succeda.",
    body:
      "Le previsioni di vendita ti dicono cosa preparare e in che quantità: meno prep buttata a fine serata, meno «finito» detto ai clienti alle nove. Le previsioni migliorano man mano che i tuoi dati crescono.",
    points: [
      "Previsione della domanda per le prossime ore e i prossimi giorni",
      "Suggerimenti di prep tarati sulla previsione — meno avanzi, meno stress",
      "Più dati carichi, più le previsioni diventano affidabili",
    ],
  },
  {
    icon: "⚙️",
    title: "Impostazioni & Billing",
    lead: "L'amministrazione in un posto solo, senza sorprese.",
    body:
      "Sedi, dipendenti e permessi, accessi rapidi con QR code per lo staff, fatturazione e piano di abbonamento: tutto in un'unica sezione. Disdici quando vuoi, esporta i tuoi dati quando vuoi.",
    points: [
      "Accessi staff con QR code: niente password da ricordare in cucina",
      "Fatturazione trasparente, cambio piano in un clic",
      "Export e cancellazione dati conformi al GDPR",
    ],
  },
];

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SavoryMind",
  url: "https://savorymind.net/ristoranti",
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

export default function RistorantiPage() {
  const router = useRouter();
  const trialHref = signupHref(router?.query, { type: "restaurant" });

  return (
    <MarketingShell lang="it" altHref="/en">
      <Head>
        <title>SavoryMind per ristoranti — I 6 moduli, spiegati</title>
        <meta
          name="description"
          content="Dashboard, Perdite & Sprechi, Coaching Staff, Menu & Margini, AI Predictions, Impostazioni & Billing: come SavoryMind ferma le perdite del tuo locale."
        />
        <link rel="canonical" href="https://savorymind.net/ristoranti" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:url" content="https://savorymind.net/ristoranti" />
        <meta property="og:title" content="SavoryMind per ristoranti — I 6 moduli, spiegati" />
        <meta
          property="og:description"
          content="Come SavoryMind trova le perdite del tuo ristorante e aiuta il tuo staff a fermarle, modulo per modulo."
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="SavoryMind per ristoranti — I 6 moduli, spiegati" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_JSONLD) }}
        />
      </Head>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Il prodotto</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Sei moduli. Un solo obiettivo: <span className="text-brand-600">fermare le perdite.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-6">
            SavoryMind non è l&rsquo;ennesimo gestionale con cento funzioni. È uno strumento che fa
            una cosa sola, fino in fondo: trovare i soldi che il tuo locale sta perdendo e aiutare
            il tuo staff a non perderli più.
          </p>
          <Link
            href={trialHref}
            className="inline-block mt-8 bg-brand-600 hover:bg-brand-700 text-white text-lg font-bold px-8 py-4 rounded-2xl shadow-lg shadow-brand-200 transition-colors"
          >
            Inizia la prova gratuita di 30 giorni
          </Link>
          <p className="text-base font-semibold text-stone-500 mt-5">
            Se non troviamo almeno €500/mese di perdite recuperabili, non paghi.
          </p>
        </div>
      </section>

      {/* Module deep-dives */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-14 md:py-20 space-y-14 md:space-y-20">
        {MODULES.map((m, i) => (
          <article
            key={m.title}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center ${
              i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">
                Modulo {i + 1} di 6
              </p>
              <h2 className="font-serif text-3xl font-bold text-stone-900 flex items-center gap-3">
                <span aria-hidden="true">{m.icon}</span> {m.title}
              </h2>
              <p className="text-lg font-semibold text-stone-800 mt-4">{m.lead}</p>
              <p className="text-base text-stone-600 leading-relaxed mt-3">{m.body}</p>
            </div>
            <ul className="bg-stone-50 border border-stone-200 rounded-3xl p-7 space-y-4">
              {m.points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="text-brand-600 font-black mt-0.5" aria-hidden="true">✓</span>
                  <span className="text-base text-stone-700 leading-relaxed">{p}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}

        {/* Everything else */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-3xl p-8 md:p-10">
          <span className="text-3xl" aria-hidden="true">🎁</span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold mt-3">E molto altro incluso</h2>
          <p className="text-lg text-brand-100 leading-relaxed mt-3 max-w-3xl">
            Prenotazioni con pagina pubblica per i tuoi clienti, CRM per riconoscere gli habitué,
            analisi del sentiment delle recensioni, strumenti di marketing. Sono già nel tuo piano:
            li trovi quando ti servono, non ti distraggono quando non ti servono.
          </p>
        </div>
      </section>

      {/* Carlos, reused */}
      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Il risultato</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 leading-tight">
              Tutto converge qui: un piano con un nome sopra.
            </h2>
            <p className="text-lg text-stone-600 leading-relaxed mt-5">
              Dashboard, sprechi, menu e previsioni alimentano lo stesso motore: il piano di
              coaching di ogni persona del tuo staff. È quello che nessun gestionale fa — ed è il
              motivo per cui i soldi smettono di uscire dalla porta sul retro.
            </p>
          </div>
          <CarlosCard plan={DEMO_PLAN} lang="it" />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-16 md:py-24 text-center">
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 leading-tight">
          Vedi la tua prima cifra <span className="text-brand-600">in 15 minuti.</span>
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <Link
            href={trialHref}
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white text-lg font-bold px-8 py-4 rounded-2xl shadow-lg shadow-brand-200 transition-colors"
          >
            Inizia la prova gratuita di 30 giorni
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto bg-white border-2 border-stone-300 hover:border-stone-400 text-stone-800 text-lg font-bold px-8 py-4 rounded-2xl transition-colors"
          >
            Guarda i prezzi
          </Link>
        </div>
        <p className="text-base font-semibold text-stone-500 mt-6">
          Se non troviamo almeno €500/mese di perdite recuperabili, non paghi.
        </p>
      </section>
    </MarketingShell>
  );
}

RistorantiPage.bareLayout = true;
