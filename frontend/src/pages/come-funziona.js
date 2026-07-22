/**
 * /come-funziona — 3-step how-it-works + demo video embed placeholder +
 * FAQ (DEVELOPER_NOTES §3.1). Copy hardcoded for crawlable HTML.
 * JSON-LD: FAQPage (§2.2 requires ≥8 Q&As here).
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import MarketingShell, { signupHref } from "../components/marketing/MarketingShell";

const STEPS = [
  {
    n: "1",
    title: "Collega il gestionale o carica un export vendite",
    body:
      "Bastano 5 minuti. Esporti le vendite dal tuo gestionale in CSV o Excel — qualsiasi formato — e lo carichi. SavoryMind riconosce da solo colonne, date e importi, anche con le virgole decimali italiane. Non hai un export a portata di mano? Nessun problema: rispondi all'audit guidato, 12 domande sulla tua cucina, e parti comunque.",
    detail: "Funziona con qualsiasi cassa · nessuna installazione · nessun hardware",
  },
  {
    n: "2",
    title: "SavoryMind trova le perdite e le quantifica in euro",
    body:
      "L'analisi incrocia acquisti, vendite, porzioni e tempi dello staff e produce una stima trasparente: «stai perdendo tra €X e €Y al mese», con la scomposizione per causa — sprechi, porzioni eccessive, tempi morti. Ogni cifra è spiegata e verificabile: vedi sempre da dove viene un numero, mai una scatola nera.",
    detail: "Stima in 15 minuti · fasce di confidenza oneste · riferimento di settore: sprechi 4–10% degli acquisti",
  },
  {
    n: "3",
    title: "Il tuo staff riceve i piani di coaching su WhatsApp",
    body:
      "Per ogni persona, SavoryMind genera un piano con azioni concrete, rispettose e misurate in euro. Tu li rivedi e li approvi con un tocco; lo staff li riceve su WhatsApp, l'app che usa già. Ogni settimana i piani si aggiornano e la dashboard mostra quanto hai recuperato.",
    detail: "Consenso esplicito per ogni dipendente · tono costruttivo, mai punitivo · anche in inglese e spagnolo",
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

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function ComeFunziona() {
  const router = useRouter();
  const trialHref = signupHref(router?.query, { type: "restaurant" });

  return (
    <MarketingShell lang="it" altHref="/en">
      <Head>
        <title>Come funziona SavoryMind — Dalla cassa al coaching</title>
        <meta
          name="description"
          content="Tre passaggi: carichi le vendite, SavoryMind quantifica le perdite in euro, il tuo staff riceve i piani di coaching su WhatsApp. Prima cifra in 15 minuti."
        />
        <link rel="canonical" href="https://savorymind.net/come-funziona" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:url" content="https://savorymind.net/come-funziona" />
        <meta property="og:title" content="Come funziona SavoryMind — Dalla cassa al coaching" />
        <meta
          property="og:description"
          content="Carichi le vendite, SavoryMind quantifica le perdite in euro, il tuo staff riceve i piani di coaching su WhatsApp."
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Come funziona SavoryMind — Dalla cassa al coaching" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
        />
      </Head>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Come funziona</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Dalla cassa al coaching, <span className="text-brand-600">in tre passaggi.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-6">
            Nessuna installazione, nessun consulente, nessun hardware. In 15 minuti vedi la prima
            stima delle tue perdite mensili — e da lì SavoryMind lavora per te ogni settimana.
          </p>
        </div>
      </section>

      {/* Demo video placeholder — Bruno supplies the asset (§3.3) */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 pb-14 md:pb-20">
        <div className="relative aspect-video w-full rounded-3xl bg-gradient-to-br from-stone-900 to-stone-800 border border-stone-700 shadow-2xl flex flex-col items-center justify-center text-center px-6 overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.25),transparent_55%)]" />
          <span className="relative w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50 mb-5">
            <span className="block w-0 h-0 border-y-[14px] border-y-transparent border-l-[22px] border-l-white ml-1.5" aria-hidden="true" />
          </span>
          <p className="relative text-white text-xl font-extrabold">Video demo in arrivo</p>
          <p className="relative text-stone-400 text-base mt-2">
            La demo di 3 minuti: dall&rsquo;export vendite al primo piano di coaching.
          </p>
        </div>
      </section>

      {/* The 3 steps */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 pb-16 md:pb-24">
        <ol className="space-y-8">
          {STEPS.map((step) => (
            <li key={step.n} className="bg-white border border-stone-200 rounded-3xl p-7 md:p-9 shadow-sm flex flex-col sm:flex-row gap-6">
              <span className="flex-shrink-0 inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-brand-600 text-white text-2xl font-extrabold">
                {step.n}
              </span>
              <div>
                <h2 className="text-2xl font-extrabold text-stone-900 leading-snug">{step.title}</h2>
                <p className="text-base md:text-lg text-stone-600 leading-relaxed mt-3">{step.body}</p>
                <p className="text-sm font-bold text-brand-700 mt-4">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="text-center mt-12">
          <Link
            href={trialHref}
            className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-lg font-bold px-8 py-4 rounded-2xl shadow-lg shadow-brand-200 transition-colors"
          >
            Inizia la prova gratuita di 30 giorni
          </Link>
          <p className="text-base font-semibold text-stone-500 mt-5">
            Se non troviamo almeno €500/mese di perdite recuperabili, non paghi.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 md:py-20">
          <h2 className="font-serif text-3xl font-bold text-stone-900 text-center mb-10">
            Domande frequenti
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
        </div>
      </section>
    </MarketingShell>
  );
}

ComeFunziona.bareLayout = true;
