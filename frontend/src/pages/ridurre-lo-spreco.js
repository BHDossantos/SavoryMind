/**
 * /ridurre-lo-spreco — crawlable B2B guide page (SEO acquisition).
 * Targets high-intent search ("come ridurre lo spreco nel ristorante") with
 * genuinely useful, honest content, then funnels to /calcolatore-spreco and
 * signup. Copy hardcoded IT for indexable HTML. JSON-LD: Article + FAQPage.
 */
import Head from "next/head";
import Link from "next/link";
import MarketingShell, { signupHref } from "../components/marketing/MarketingShell";

const TACTICS = [
  {
    n: "1",
    title: "Misura prima di tagliare",
    body: "Non si riduce ciò che non si misura. Pesa lo scarto per una settimana, diviso per stazione (preparazione, cottura, avanzi di sala). Quasi sempre il grosso della perdita si concentra in due o tre piatti: lì conviene intervenire per primi.",
  },
  {
    n: "2",
    title: "Porziona con criterio, non a occhio",
    body: "La porzione eccessiva è spreco invisibile: il cliente non la nota, il tuo margine sì. Standardizza le grammature dei piatti a più alto volume con bilance e mestoli dosatori; una correzione del 5-8% sui primi piatti si vede subito sul food cost.",
  },
  {
    n: "3",
    title: "Ordina sui consumi reali, non sull'abitudine",
    body: "Allinea gli ordini ai coperti previsti per giorno della settimana. Le materie prime deperibili ordinate «come sempre» finiscono nel bidone il lunedì. Un forecast anche semplice, basato sullo storico, riduce gli acquisti in eccesso senza rischiare la rottura di stock.",
  },
  {
    n: "4",
    title: "Recupera con il menù, non con il cestino",
    body: "Progetta il menù perché gli ingredienti si incrocino: lo scarto di una preparazione è la base di un'altra (fondi, paste, sughi del giorno). Il cross-utilizzo è il modo più elegante di trasformare una perdita in un piatto che vende.",
  },
  {
    n: "5",
    title: "Coinvolgi lo staff, con i numeri giusti",
    body: "Lo spreco si riduce in cucina, persona per persona. Condividi cifre concrete e rispettose — «questa settimana €X di scarto su questa stazione» — e trasformale in obiettivi settimanali. Il tono conta: costruttivo, mai punitivo.",
  },
];

const FAQS = [
  {
    q: "Quanto spreco alimentare ha in media un ristorante?",
    a: "Tra il 4% e il 10% degli acquisti di cibo. Su €10.000 di materie prime al mese sono €400–€1.000 buttati, prima ancora di contare porzioni eccessive e tempi morti dello staff.",
  },
  {
    q: "Da dove conviene iniziare per ridurre lo spreco?",
    a: "Dalla misura. Una settimana di pesatura dello scarto per stazione rivela quasi sempre due o tre voci che valgono la maggior parte della perdita: si parte da quelle, non da tutto insieme.",
  },
  {
    q: "Ridurre le porzioni non peggiora l'esperienza del cliente?",
    a: "No, se la porzione era sovradimensionata. Standardizzare le grammature sui piatti ad alto volume riporta la porzione al valore corretto: il cliente non se ne accorge, il margine sì.",
  },
  {
    q: "Quanto posso risparmiare davvero?",
    a: "Dipende dai tuoi numeri. Il calcolatore gratuito ti dà una stima onesta in euro, scomposta per causa, in un minuto — così sai da dove partire e quanto c'è in gioco.",
  },
];

export default function RidurreLoSpreco() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Come ridurre lo spreco alimentare nel tuo ristorante",
        description: "Cinque leve concrete per ridurre lo spreco in cucina — misura, porzioni, ordini, menù, staff — e quanto vale davvero per il tuo margine.",
        inLanguage: "it-IT",
        author: { "@type": "Organization", name: "SavoryMind" },
        publisher: { "@type": "Organization", name: "SavoryMind" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <Head>
        <title>Come ridurre lo spreco alimentare nel ristorante — Guida pratica | SavoryMind</title>
        <meta
          name="description"
          content="Guida pratica: 5 leve concrete per ridurre lo spreco alimentare nel tuo ristorante — misura, porzioni, ordini, cross-utilizzo, staff. Con calcolatore gratuito per stimare quanto perdi."
        />
        <link rel="canonical" href="https://savorymind.net/ridurre-lo-spreco" />
        <meta property="og:title" content="Come ridurre lo spreco alimentare nel tuo ristorante" />
        <meta property="og:description" content="5 leve concrete per ridurre lo spreco in cucina, con una stima onesta di quanto vale per il tuo margine." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://savorymind.net/ridurre-lo-spreco" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <MarketingShell lang="it">
        <article className="max-w-2xl mx-auto px-4 pt-12 pb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            Come ridurre lo spreco alimentare nel tuo ristorante
          </h1>
          <p className="text-lg text-gray-600 mt-4">
            Lo spreco vale tra il 4% e il 10% di quanto compri in cibo — €400–€1.000 al mese
            per un ristorante che acquista €10.000. La buona notizia: è la perdita più facile
            da ridurre, se sai dove guardare. Ecco cinque leve concrete.
          </p>

          <div className="mt-8 space-y-8">
            {TACTICS.map((tac) => (
              <section key={tac.n}>
                <h2 className="text-xl font-bold text-gray-900">
                  <span className="text-brand-500">{tac.n}.</span> {tac.title}
                </h2>
                <p className="text-gray-600 mt-2 leading-relaxed">{tac.body}</p>
              </section>
            ))}
          </div>

          {/* Funnel CTA → calculator */}
          <div className="mt-10 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6 text-center">
            <p className="font-bold text-gray-900 text-lg">Quanto stai perdendo, in euro?</p>
            <p className="text-sm text-gray-600 mt-1 mb-4">
              Inserisci quattro numeri e ottieni una stima onesta, scomposta per causa, in un minuto.
            </p>
            <Link
              href="/calcolatore-spreco"
              className="inline-block px-6 py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition"
            >
              Calcola il tuo spreco →
            </Link>
          </div>

          <section className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Domande frequenti</h2>
            <div className="space-y-4">
              {FAQS.map((f, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="font-semibold text-gray-900 text-sm">{f.q}</h3>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="text-sm text-gray-500 mt-10">
            SavoryMind trova le perdite al posto tuo e genera i piani per recuperarle.{" "}
            <Link href={signupHref({}, { type: "restaurant", src: "guida-spreco" })} className="text-brand-600 font-semibold hover:underline">
              Prova gratis
            </Link>
            .
          </p>
        </article>
      </MarketingShell>
    </>
  );
}
