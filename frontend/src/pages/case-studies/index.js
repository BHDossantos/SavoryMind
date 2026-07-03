/**
 * /case-studies — index page. Ships ONE realistic-but-clearly-labeled
 * demo case study ("Esempio dimostrativo") until real pilots replace it
 * (DEVELOPER_NOTES §8.3). Never presented as a real client — no fake
 * numbers without a label (§12). Copy hardcoded for crawlable HTML.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import MarketingShell, { signupHref } from "../../components/marketing/MarketingShell";

export default function CaseStudiesIndex() {
  const router = useRouter();
  const trialHref = signupHref(router?.query, { type: "restaurant" });

  return (
    <MarketingShell lang="it" altHref="/en">
      <Head>
        <title>Case study — Risultati in euro | SavoryMind</title>
        <meta
          name="description"
          content="Come SavoryMind trova e recupera le perdite dei ristoranti, raccontato con i numeri. I primi casi reali dei piloti di Roma arrivano qui."
        />
        <link rel="canonical" href="https://savorymind.net/case-studies" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:url" content="https://savorymind.net/case-studies" />
        <meta property="og:title" content="Case study — Risultati in euro | SavoryMind" />
        <meta
          property="og:description"
          content="Come SavoryMind trova e recupera le perdite dei ristoranti, raccontato con i numeri."
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Case study — Risultati in euro | SavoryMind" />
      </Head>

      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Case study</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Risultati che si contano <span className="text-brand-600">in euro.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-6">
            Stiamo lavorando con i primi ristoranti pilota a Roma: i loro casi reali arriveranno in
            questa pagina, con numeri verificati. Nel frattempo, ecco un esempio — chiaramente
            indicato come dimostrativo — di come si presenta un percorso tipo.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 sm:px-6 pb-16 md:pb-24">
        {/* Demo case study card — ALWAYS labeled, never a real client */}
        <article className="bg-white border border-stone-200 rounded-3xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-7 py-6 md:px-9 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-brand-100 text-sm font-bold uppercase tracking-widest">Trattoria · Trastevere, Roma</p>
              <h2 className="text-white font-serif text-2xl md:text-3xl font-bold mt-1">
                Otto settimane per riprendersi €740 al mese
              </h2>
            </div>
            <span className="bg-white/15 border border-white/30 text-white text-xs font-extrabold uppercase tracking-wide rounded-full px-3.5 py-1.5">
              Esempio dimostrativo
            </span>
          </div>

          <div className="px-7 py-7 md:px-9 md:py-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
              <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-2xl md:text-3xl font-extrabold text-stone-900 tabular-nums">€1.240<span className="text-base font-bold text-stone-500">/mese</span></p>
                <p className="text-sm font-semibold text-stone-500 mt-1">di perdite trovate</p>
              </div>
              <div className="bg-brand-50 border border-brand-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-2xl md:text-3xl font-extrabold text-brand-700 tabular-nums">€740<span className="text-base font-bold text-brand-600/70">/mese</span></p>
                <p className="text-sm font-semibold text-brand-700/80 mt-1">recuperati</p>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-2xl md:text-3xl font-extrabold text-stone-900 tabular-nums">8</p>
                <p className="text-sm font-semibold text-stone-500 mt-1">settimane</p>
              </div>
            </div>

            <p className="text-base md:text-lg text-stone-600 leading-relaxed">
              Una trattoria da 45 coperti nel cuore di Trastevere. L&rsquo;audit iniziale ha trovato
              €1.240/mese di perdite: porzioni di pasta cresciute del 18% rispetto alla ricetta,
              prep del weekend buttata il lunedì, e mezz&rsquo;ora al giorno persa in conte manuali.
              Con i piani di coaching su WhatsApp e due cambi di processo, in otto settimane il
              recupero è arrivato a €740/mese — verificato sui numeri, non a sensazione.
            </p>

            <blockquote className="mt-7 border-l-4 border-brand-500 pl-5 py-1">
              <p className="font-serif italic text-lg md:text-xl text-stone-800 leading-relaxed">
                &ldquo;Non immaginavo che le porzioni della carbonara ci costassero così tanto. Ora
                lo vedo in euro, ogni settimana — e lo vede anche la mia brigata.&rdquo;
              </p>
              <footer className="text-sm font-bold text-stone-500 mt-3">
                Titolare della trattoria — esempio dimostrativo, non un cliente reale
              </footer>
            </blockquote>
          </div>
        </article>

        <div className="text-center mt-12">
          <p className="text-lg text-stone-600 mb-6">
            Vuoi essere uno dei primi casi reali su questa pagina?
          </p>
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
    </MarketingShell>
  );
}

CaseStudiesIndex.bareLayout = true;
