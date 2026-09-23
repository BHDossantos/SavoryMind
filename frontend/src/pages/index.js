/**
 * B2B homepage (Italian primary) — the repositioned marketing site
 * (DEVELOPER_NOTES §3). Sells to restaurant owners, Rome-first.
 *
 * All copy is HARDCODED in the JSX — no react-i18next — so the full text
 * ships in the server-rendered HTML and crawlers/AI answer engines see a
 * real page (the P0 fix in §2). The English mirror lives at /en.
 *
 * Logged-in users are still redirected to their app (OAuth callbacks land
 * on "/"), but the page never blanks while auth hydrates: the marketing
 * HTML always renders.
 */
import Head from "next/head";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import MarketingShell, { signupHref } from "../components/marketing/MarketingShell";
import CarlosCard, { DEMO_PLAN } from "../components/marketing/CarlosCard";
import PricingTiers from "../components/marketing/PricingTiers";
import { track } from "../lib/analytics";

const STEPS = [
  {
    n: "1",
    title: "Collega il gestionale o carica un export vendite",
    body:
      "Un file CSV o Excel da qualsiasi cassa va benissimo. Non hai dati a portata di mano? Rispondi a un audit guidato di 15 minuti — bastano le tue risposte.",
  },
  {
    n: "2",
    title: "SavoryMind trova le perdite e le quantifica in euro",
    body:
      "Sprechi, porzioni eccessive, tempi morti dello staff: ogni perdita viene individuata, spiegata e tradotta in una cifra mensile che puoi verificare.",
  },
  {
    n: "3",
    title: "Il tuo staff riceve i piani di coaching su WhatsApp",
    body:
      "Niente nuove app da installare: ogni persona riceve azioni concrete e rispettose sul telefono che usa già. Tu approvi tutto prima dell'invio.",
  },
];

const MODULES = [
  {
    icon: "📊",
    title: "Dashboard",
    body: "La tua perdita mensile stimata e i soldi recuperati fino a oggi — il primo numero che vedi ogni mattina.",
  },
  {
    icon: "🗑️",
    title: "Perdite & Sprechi",
    body: "Ogni chilo buttato registrato in 20 secondi dalla cucina, con costo in euro e causa. Inventario incluso.",
  },
  {
    icon: "🎓",
    title: "Coaching Staff",
    body: "Piani personalizzati per ogni dipendente: cosa migliorare, come, e quanto vale. Costruttivi, mai punitivi.",
  },
  {
    icon: "🍝",
    title: "Menu & Margini",
    body: "Quali piatti guadagnano davvero e quali ti costano. Prezzi, porzioni e tendenze in un colpo d'occhio.",
  },
  {
    icon: "🔮",
    title: "AI Predictions",
    body: "Cosa venderai nelle prossime ore e nei prossimi giorni, prima che arrivi il pienone — o il vuoto.",
  },
  {
    icon: "⚙️",
    title: "Impostazioni & Billing",
    body: "Sedi, dipendenti, accessi con QR code e fatturazione: tutta l'amministrazione in un posto solo.",
  },
];

const FAQS = [
  {
    q: "Quanto costa davvero lo spreco alimentare a un ristorante?",
    a: "Nel settore lo spreco alimentare vale tra il 4% e il 10% degli acquisti di cibo. Per un ristorante che compra €10.000 di materie prime al mese significa tra €400 e €1.000 buttati — prima ancora di contare porzioni eccessive e tempi morti dello staff. SavoryMind calcola la tua cifra reale, in euro, e ti mostra da dove viene.",
  },
  {
    q: "È compatibile con il mio gestionale o POS?",
    a: "Sì. Puoi caricare un export vendite in CSV o Excel da qualsiasi gestionale, oppure iniziare senza alcun dato con un audit guidato di 15 minuti. Le integrazioni dirette con i POS più diffusi in Italia sono in sviluppo.",
  },
  {
    q: "I dati dei miei dipendenti sono al sicuro? (GDPR)",
    a: "Sì. SavoryMind è progettato per il GDPR: ogni dipendente può richiedere l'export o la cancellazione dei propri dati, l'invio dei piani su WhatsApp avviene solo dopo consenso esplicito, e all'AI inviamo solo il nome e le metriche di lavoro — mai i contatti personali.",
  },
  {
    q: "In che lingue funziona?",
    a: "L'interfaccia è in italiano e in inglese. I piani di coaching per lo staff possono essere generati anche in spagnolo — le cucine di Roma sono multilingue, e lo sappiamo bene.",
  },
  {
    q: "Come funziona la garanzia?",
    a: "Provi SavoryMind gratis per 30 giorni. Se al termine non abbiamo identificato almeno €500 al mese di perdite recuperabili, non paghi nulla. E se la tua cucina è già molto efficiente, te lo diciamo onestamente: nessun numero gonfiato, mai.",
  },
  {
    q: "Quanto tempo serve per partire?",
    a: "Circa 15 minuti. Rispondi alle domande dell'audit guidato (o carichi un export vendite) e vedi subito la prima stima delle tue perdite mensili. Nessuna installazione, nessun hardware, nessun consulente.",
  },
  {
    q: "Il mio staff deve installare un'app?",
    a: "No. Lo staff riceve i piani di coaching direttamente su WhatsApp, l'app che usa già ogni giorno. Il titolare gestisce tutto dalla dashboard web, comodamente anche dal telefono.",
  },
  {
    q: "Posso disdire quando voglio?",
    a: "Sì, in qualsiasi momento dalla sezione fatturazione, senza penali e con effetto a fine periodo. I tuoi dati restano esportabili.",
  },
];

const ORG_WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://savorymind.net/#organization",
      name: "SavoryMind",
      url: "https://savorymind.net/",
      logo: "https://savorymind.net/api/og/wedge",
      description:
        "SavoryMind trova le perdite economiche dei ristoranti — sprechi, porzioni, tempi dello staff — e genera piani di coaching personalizzati per fermarle.",
      address: { "@type": "PostalAddress", addressLocality: "Roma", addressCountry: "IT" },
    },
    {
      "@type": "WebSite",
      "@id": "https://savorymind.net/#website",
      url: "https://savorymind.net/",
      name: "SavoryMind",
      publisher: { "@id": "https://savorymind.net/#organization" },
      inLanguage: ["it-IT", "en-US"],
    },
  ],
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

export default function HomeIT() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const trialHref = signupHref(router?.query, { type: "restaurant" });

  // OAuth flows land logged-in users on "/" — send them to their app.
  // No `return null` while loading: the marketing HTML must always render.
  useEffect(() => {
    if (!loading && user) {
      if (user.account_type === "consumer" || user.account_type === "diner") router.replace("/consumer/dashboard");
      else if (user.account_type === "staff") router.replace("/staff-portal");
      else router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <MarketingShell lang="it" altHref="/en">
      <Head>
        <title>SavoryMind — Trova le perdite del tuo ristorante, in euro</title>
        <meta
          name="description"
          content="SavoryMind trova le perdite del tuo ristorante — sprechi, porzioni, tempi dello staff — e genera piani di coaching per fermarle. Prova gratis 30 giorni."
        />
        <link rel="canonical" href="https://savorymind.net/" />
        <link rel="alternate" hrefLang="it-IT" href="https://savorymind.net/" />
        <link rel="alternate" hrefLang="en-US" href="https://savorymind.net/en" />
        <link rel="alternate" hrefLang="x-default" href="https://savorymind.net/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:url" content="https://savorymind.net/" />
        <meta property="og:title" content="Il tuo ristorante sta perdendo €500–2.000 al mese. Noi ti mostriamo dove." />
        <meta
          property="og:description"
          content="Sprechi, porzioni, tempi dello staff: SavoryMind li trova, li quantifica in euro e genera piani di coaching per fermarli."
        />
        <meta property="og:image" content="https://savorymind.net/api/og/wedge" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SavoryMind — Trova le perdite del tuo ristorante, in euro" />
        <meta
          name="twitter:description"
          content="Sprechi, porzioni, tempi dello staff: SavoryMind li trova, li quantifica in euro e genera piani di coaching per fermarli."
        />
        <meta name="twitter:image" content="https://savorymind.net/api/og/wedge" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_WEBSITE_JSONLD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
        />
      </Head>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-16 pb-14 md:pt-24 md:pb-20 text-center">
          <p className="inline-flex items-center gap-2 bg-white border border-brand-200 text-brand-700 text-sm font-bold px-4 py-1.5 rounded-full mb-7 shadow-sm">
            <span aria-hidden="true">🇮🇹</span> Per ristoranti, trattorie e pizzerie — Roma prima di tutto
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-stone-900 leading-[1.12] tracking-tight max-w-4xl mx-auto">
            Il tuo ristorante sta perdendo €500–2.000 al mese.{" "}
            <span className="text-brand-600">Noi ti mostriamo dove.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-6">
            SavoryMind analizza sprechi, porzioni e tempi del tuo staff — e genera piani di coaching
            personalizzati per fermare le perdite. In 15 minuti vedi la tua prima cifra.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-9">
            <Link
              href={trialHref}
              onClick={() => track("marketing_cta_click", { page: "home_it", cta: "hero_trial" })}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white text-lg font-bold px-8 py-4 rounded-2xl shadow-lg shadow-brand-200 transition-colors"
            >
              Inizia la prova gratuita di 30 giorni
            </Link>
            <Link
              href="/come-funziona"
              onClick={() => track("marketing_cta_click", { page: "home_it", cta: "hero_demo" })}
              className="w-full sm:w-auto bg-white border-2 border-stone-300 hover:border-stone-400 text-stone-800 text-lg font-bold px-8 py-4 rounded-2xl transition-colors"
            >
              Guarda la demo di 3 minuti
            </Link>
          </div>
          <p className="text-base font-semibold text-stone-500 mt-6">
            Se non troviamo almeno €500/mese di perdite recuperabili, non paghi.
          </p>
          <p className="text-sm text-stone-500 mt-3">
            Oppure{" "}
            <Link
              href="/calcolatore-spreco"
              onClick={() => track("marketing_cta_click", { page: "home_it", cta: "hero_calculator" })}
              className="font-bold text-brand-700 hover:text-brand-600 underline"
            >
              calcola subito quanto stai perdendo →
            </Link>
          </p>
        </div>
      </section>

      {/* ── The Carlos moment ────────────────────────────────────── */}
      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Il momento Carlos</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 leading-tight">
              Non «lo spreco costa». <br className="hidden md:block" />
              «Carlos, martedì, €36,90.»
            </h2>
            <p className="text-lg text-stone-600 leading-relaxed mt-5">
              I gestionali ti dicono che qualcosa non va. SavoryMind ti dice <strong>chi</strong>,{" "}
              <strong>quanto</strong> e <strong>perché</strong> — e poi genera un piano di coaching
              concreto e rispettoso per ogni persona del tuo staff. Nessuna colpa, solo processi da
              sistemare: la cucina migliora e le persone crescono.
            </p>
            <ul className="mt-6 space-y-3 text-base text-stone-700">
              <li className="flex items-start gap-3">
                <span className="text-brand-600 font-black mt-0.5" aria-hidden="true">✓</span>
                Ogni episodio di spreco registrato in 20 secondi, durante il servizio
              </li>
              <li className="flex items-start gap-3">
                <span className="text-brand-600 font-black mt-0.5" aria-hidden="true">✓</span>
                Impatto calcolato in euro e chili, mai a sensazione
              </li>
              <li className="flex items-start gap-3">
                <span className="text-brand-600 font-black mt-0.5" aria-hidden="true">✓</span>
                Piani approvati da te prima di arrivare allo staff
              </li>
            </ul>
          </div>
          <CarlosCard plan={DEMO_PLAN} lang="it" />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="come-funziona" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">Come funziona</p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
            Dalla cassa al coaching in tre passaggi
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div key={step.n} className="bg-white border border-stone-200 rounded-3xl p-7 shadow-sm">
              <span className="inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-brand-600 text-white text-xl font-extrabold mb-5">
                {step.n}
              </span>
              <h3 className="text-xl font-extrabold text-stone-900 leading-snug">{step.title}</h3>
              <p className="text-base text-stone-600 leading-relaxed mt-3">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/come-funziona" className="text-base font-bold text-brand-700 hover:text-brand-600">
            Guarda la demo di 3 minuti →
          </Link>
        </div>
      </section>

      {/* ── What's included ──────────────────────────────────────── */}
      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">Cosa è incluso</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
              Tutto quello che serve, niente di superfluo
            </h2>
            <p className="text-lg text-stone-600 mt-4 max-w-2xl mx-auto">
              Sei moduli chiari, pensati per chi ha un ristorante da mandare avanti — non un software da studiare.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map((m) => (
              <div key={m.title} className="bg-white border border-stone-200 rounded-3xl p-6 hover:border-brand-400 hover:shadow-md transition-all">
                <span className="text-3xl" aria-hidden="true">{m.icon}</span>
                <h3 className="text-lg font-extrabold text-stone-900 mt-3">{m.title}</h3>
                <p className="text-base text-stone-600 leading-relaxed mt-2">{m.body}</p>
              </div>
            ))}
            <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-3xl p-6 sm:col-span-2 lg:col-span-3">
              <span className="text-3xl" aria-hidden="true">🎁</span>
              <h3 className="text-lg font-extrabold mt-3">E molto altro incluso</h3>
              <p className="text-base text-brand-100 leading-relaxed mt-2 max-w-3xl">
                Prenotazioni, CRM clienti, analisi del sentiment delle recensioni, strumenti di
                marketing e altro ancora — già compresi nel tuo piano, pronti quando ti servono.
              </p>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link href="/ristoranti" className="text-base font-bold text-brand-700 hover:text-brand-600">
              Scopri il prodotto in dettaglio →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="prezzi" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">Prezzi</p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
            Un piano per ogni cucina
          </h2>
          <p className="text-lg text-stone-600 mt-4">
            Meno di quello che perdi in una settimana di sprechi.
          </p>
        </div>
        <PricingTiers lang="it" />
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="text-center mb-10">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">Domande frequenti</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
              Le domande che ci fanno tutti i titolari
            </h2>
          </div>
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
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-16 md:py-24 text-center">
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 leading-tight">
          Scopri quanto stai perdendo. <span className="text-brand-600">Oggi.</span>
        </h2>
        <p className="text-lg text-stone-600 mt-4">
          15 minuti per la prima cifra. 30 giorni per verificarla. Zero rischio.
        </p>
        <Link
          href={trialHref}
          onClick={() => track("marketing_cta_click", { page: "home_it", cta: "footer_trial" })}
          className="inline-block mt-8 bg-brand-600 hover:bg-brand-700 text-white text-lg font-bold px-10 py-4 rounded-2xl shadow-lg shadow-brand-200 transition-colors"
        >
          Inizia la prova gratuita di 30 giorni
        </Link>
        <p className="text-base font-semibold text-stone-500 mt-5">
          Se non troviamo almeno €500/mese di perdite recuperabili, non paghi.
        </p>

        {/* Secondary consumer path — small by design (§3.1) */}
        <p className="mt-14 text-base text-stone-500">
          Ami il cibo?{" "}
          <Link href="/per-chi-ama-il-cibo" className="font-bold text-consumer-600 hover:text-consumer-700">
            Scopri l&rsquo;app per chi mangia →
          </Link>
        </p>
      </section>
    </MarketingShell>
  );
}

// Render outside the app shell — marketing surface, no auth gate/nav.
HomeIT.bareLayout = true;
