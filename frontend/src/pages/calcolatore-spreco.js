/**
 * /calcolatore-spreco — public, crawlable waste calculator (lead magnet).
 * Wired to POST /api/loss/public-estimate — the SAME loss engine as the
 * post-signup onboarding, so the number here matches what the operator sees
 * inside. Copy hardcoded in Italian for crawlable HTML + SEO. JSON-LD:
 * WebApplication + FAQPage. Honest by design: missing inputs widen the band
 * and lower confidence; an efficient kitchen sees "sei già efficiente", never
 * a fabricated scary number.
 */
import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import MarketingShell, { signupHref } from "../components/marketing/MarketingShell";
import { fmtEur } from "../components/restaurant/LossReveal";
import { api } from "../services/api";

const CAT_LABELS = {
  food_waste: "Sprechi alimentari",
  over_portioning: "Porzioni eccessive",
  staff_time: "Tempo dello staff",
};
const CONFIDENCE_LABELS = { high: "Alta", medium: "Media", low: "Bassa" };

const FIELDS = [
  { key: "covers_per_day", label: "Coperti al giorno", placeholder: "es. 80", hint: "In media, tutti i servizi." },
  { key: "avg_ticket_eur", label: "Scontrino medio (€)", placeholder: "es. 28", hint: "Spesa media per coperto." },
  { key: "staff_count", label: "Persone in sala e cucina", placeholder: "es. 6", hint: "Totale dello staff operativo." },
  { key: "monthly_food_purchases_eur", label: "Acquisti di cibo al mese (€)", placeholder: "es. 12000", hint: "Materie prime, fornitori inclusi." },
];

const FAQS = [
  {
    q: "Quanto spreco ha in media un ristorante?",
    a: "Nel settore lo spreco alimentare vale tra il 4% e il 10% degli acquisti di cibo. Su €10.000 di materie prime al mese sono €400–€1.000 buttati, prima ancora di contare porzioni eccessive e tempi morti.",
  },
  {
    q: "Come fa il calcolatore a stimare la mia cifra?",
    a: "Incrocia i tuoi numeri (coperti, scontrino, staff, acquisti) con i riferimenti di settore e produce una fascia onesta €X–€Y al mese, scomposta per causa. Ogni voce è spiegata: nessuna scatola nera.",
  },
  {
    q: "I miei dati vengono salvati?",
    a: "No. Il calcolatore pubblico non salva nulla: la stima è calcolata al volo e resta sul tuo schermo. Crei un account solo se vuoi la scoperta completa e i piani di recupero.",
  },
  {
    q: "E se il mio ristorante è già efficiente?",
    a: "Se i tuoi numeri indicano una cucina già molto efficiente, te lo diciamo — niente cifra gonfiata. La nostra garanzia da €500 nasce proprio da qui: paghi solo se troviamo perdite reali.",
  },
];

export default function CalcolatoreSpreco() {
  const [vals, setVals] = useState({});
  const [lastBody, setLastBody] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const set = (k, v) => setVals((p) => ({ ...p, [k]: v }));

  const calculate = async () => {
    setLoading(true); setError(false); setResult(null);
    const body = {};
    for (const f of FIELDS) {
      const raw = (vals[f.key] ?? "").toString().replace(",", ".").trim();
      if (raw !== "" && !Number.isNaN(Number(raw))) body[f.key] = Number(raw);
    }
    try {
      setLastBody(body);
      setResult(await api.submitPublicEstimate(body));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calcolatore Spreco Ristorante",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        description: "Calcola in un minuto quanto sta perdendo il tuo ristorante ogni mese tra sprechi, porzioni eccessive e tempi morti.",
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
        <title>Calcolatore Spreco Ristorante — Quanto stai perdendo al mese? | SavoryMind</title>
        <meta
          name="description"
          content="Calcolatore gratuito: scopri in un minuto quanto perde il tuo ristorante ogni mese tra sprechi, porzioni eccessive e tempi morti. Stima trasparente in euro, nessun dato salvato."
        />
        <link rel="canonical" href="https://savorymind.net/calcolatore-spreco" />
        <meta property="og:title" content="Quanto sta perdendo il tuo ristorante ogni mese?" />
        <meta property="og:description" content="Calcolatore gratuito dello spreco per ristoranti. Stima onesta in euro, scomposta per causa." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://savorymind.net/calcolatore-spreco" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <MarketingShell lang="it">
        <section className="max-w-3xl mx-auto px-4 pt-12 pb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
            Quanto sta perdendo il tuo ristorante ogni mese?
          </h1>
          <p className="text-lg text-gray-600 mt-4">
            Inserisci quattro numeri. In un minuto vedi una stima onesta — in euro, scomposta
            per causa — di quanto se ne va tra sprechi, porzioni eccessive e tempi morti.
          </p>
          <p className="text-sm text-gray-400 mt-2">Gratis · nessun dato salvato · nessuna registrazione</p>
        </section>

        <section className="max-w-2xl mx-auto px-4 pb-16">
          <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{f.label}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vals[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">{f.hint}</p>
                </div>
              ))}
            </div>
            <button
              onClick={calculate}
              disabled={loading}
              className="mt-6 w-full py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {loading ? "Calcolo in corso…" : "Calcola quanto perdo"}
            </button>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Più campi compili, più la stima è precisa. Puoi anche lasciarne qualcuno vuoto:
              la fascia si allarga e la confidenza scende, ma non gonfiamo mai il numero.
            </p>
            {error && (
              <p className="text-sm text-red-600 mt-4 text-center">
                Qualcosa è andato storto nel calcolo. Riprova tra un momento.
              </p>
            )}
          </div>

          {result && <Result result={result} body={lastBody} />}
        </section>

        {/* Crawlable FAQ */}
        <section className="max-w-2xl mx-auto px-4 pb-20">
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
      </MarketingShell>
    </>
  );
}

function Result({ result, body }) {
  const low = Number(result.total_monthly_loss_low) || 0;
  const high = Number(result.total_monthly_loss_high) || 0;
  const breakdown = result.breakdown || [];
  const efficient = high <= 0;

  return (
    <div className="mt-6 bg-gradient-to-br from-brand-50 to-white rounded-2xl border border-brand-200 shadow-sm p-6 sm:p-8">
      {efficient ? (
        <div className="text-center">
          <p className="text-2xl font-extrabold text-green-700">La tua cucina è già molto efficiente 👏</p>
          <p className="text-gray-600 mt-2">
            Con i numeri che hai inserito non emergono perdite evidenti. È un ottimo segnale —
            e il motivo per cui offriamo una garanzia da €500: paghi solo se troviamo perdite reali.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 text-center">
            Stai perdendo circa
          </p>
          <p className="text-center text-3xl sm:text-4xl font-extrabold text-gray-900 mt-1">
            {fmtEur(low, "it")} – {fmtEur(high, "it")}
            <span className="text-lg font-semibold text-gray-500"> al mese</span>
          </p>

          <div className="mt-6 space-y-3">
            {breakdown.map((c) => (
              <div key={c.category} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{CAT_LABELS[c.category] || c.category}</p>
                  <p className="text-xs text-gray-400">
                    Confidenza: {CONFIDENCE_LABELS[c.confidence] || c.confidence}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {fmtEur(c.amount_low, "it")} – {fmtEur(c.amount_high, "it")}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-4">
            Riferimento di settore: lo spreco alimentare vale il 4–10% degli acquisti. Ogni cifra è
            una stima trasparente basata sui numeri che hai inserito, non una scatola nera.
          </p>
        </>
      )}

      <div className="mt-6 text-center">
        <Link
          href={signupHref({}, { type: "restaurant", src: "calcolatore" })}
          className="inline-block px-6 py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition"
        >
          Scopri dove — prova gratis
        </Link>
        <p className="text-xs text-gray-400 mt-2">
          Collega le vendite e ricevi la scoperta completa + i piani per recuperarlo.
        </p>
      </div>

      <LeadForm body={body} result={result} />
    </div>
  );
}

function LeadForm({ body, result }) {
  const [email, setEmail] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done | error

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = async () => {
    if (!valid) return;
    setStatus("sending");
    try {
      await api.submitLead({
        email: email.trim(),
        restaurant_name: restaurant.trim() || undefined,
        ...body,
        band_low: result.total_monthly_loss_low,
        band_high: result.total_monthly_loss_high,
        source: "calcolatore",
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="mt-6 border-t border-brand-100 pt-5 text-center">
        <p className="font-semibold text-green-700">Fatto — ti scriviamo a breve 📩</p>
        <p className="text-sm text-gray-500 mt-1">
          Ti invieremo il report dettagliato e come iniziare a recuperare queste perdite.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-brand-100 pt-5">
      <p className="text-sm font-semibold text-gray-800">Vuoi il report dettagliato via email?</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">
        Nessuno spam — solo la tua analisi e i prossimi passi. Puoi disiscriverti quando vuoi.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          placeholder="Nome del ristorante (facoltativo)"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="La tua email"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          onClick={submit}
          disabled={!valid || status === "sending"}
          className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black disabled:opacity-40 transition whitespace-nowrap"
        >
          {status === "sending" ? "Invio…" : "Invia"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-red-600 mt-2">Invio non riuscito. Riprova tra un momento.</p>
      )}
    </div>
  );
}
