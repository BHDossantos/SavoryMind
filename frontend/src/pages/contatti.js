/**
 * /contatti — contact page: email card, WhatsApp CTA, demo booking CTA,
 * address (DEVELOPER_NOTES §3.1). Copy hardcoded for crawlable HTML.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import MarketingShell, { signupHref } from "../components/marketing/MarketingShell";

// TODO(Bruno): replace with the real business WhatsApp number once active.
const WHATSAPP_URL = "https://wa.me/393000000000";
const CONTACT_EMAIL = "ciao@savorymind.net";

export default function Contatti() {
  const router = useRouter();
  const trialHref = signupHref(router?.query, { type: "restaurant" });

  return (
    <MarketingShell lang="it" altHref="/en">
      <Head>
        <title>Contatti — Parla con SavoryMind</title>
        <meta
          name="description"
          content="Scrivici, mandaci un WhatsApp o prenota una demo di 15 minuti. Rispondiamo in giornata, in italiano. SavoryMind — Roma, Italia."
        />
        <link rel="canonical" href="https://savorymind.net/contatti" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="it_IT" />
        <meta property="og:url" content="https://savorymind.net/contatti" />
        <meta property="og:title" content="Contatti — Parla con SavoryMind" />
        <meta
          property="og:description"
          content="Scrivici, mandaci un WhatsApp o prenota una demo di 15 minuti. Rispondiamo in giornata, in italiano."
        />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Contatti — Parla con SavoryMind" />
      </Head>

      <section className="bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">Contatti</p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Parliamo del tuo locale. <span className="text-brand-600">In italiano, senza filtri.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-6">
            Siamo a Roma e rispondiamo in giornata. Scegli il canale che preferisci — per un
            titolare al lavoro, spesso il più comodo è WhatsApp.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-16 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Email */}
          <div className="bg-white border border-stone-200 rounded-3xl p-7 shadow-sm flex flex-col">
            <span className="text-3xl" aria-hidden="true">✉️</span>
            <h2 className="text-xl font-extrabold text-stone-900 mt-4">Scrivici una mail</h2>
            <p className="text-base text-stone-600 leading-relaxed mt-2 flex-1">
              Per domande sul prodotto, sui prezzi o sulla privacy. Rispondiamo entro un giorno
              lavorativo.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-6 block text-center bg-stone-900 hover:bg-stone-800 text-white font-bold px-5 py-3.5 rounded-2xl transition-colors break-all"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

          {/* WhatsApp */}
          <div className="bg-white border-2 border-brand-200 rounded-3xl p-7 shadow-md flex flex-col relative">
            <span className="absolute -top-3 left-7 bg-brand-500 text-white text-xs font-extrabold uppercase tracking-wide rounded-full px-3 py-1">
              Il più rapido
            </span>
            <span className="text-3xl" aria-hidden="true">💬</span>
            <h2 className="text-xl font-extrabold text-stone-900 mt-4">Mandaci un WhatsApp</h2>
            <p className="text-base text-stone-600 leading-relaxed mt-2 flex-1">
              Come faresti con un fornitore: un messaggio quando hai due minuti, anche tra un
              servizio e l&rsquo;altro.
            </p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block text-center bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-3.5 rounded-2xl transition-colors"
            >
              Apri WhatsApp
            </a>
          </div>

          {/* Demo */}
          <div className="bg-white border border-stone-200 rounded-3xl p-7 shadow-sm flex flex-col">
            <span className="text-3xl" aria-hidden="true">📅</span>
            <h2 className="text-xl font-extrabold text-stone-900 mt-4">Prenota una demo</h2>
            <p className="text-base text-stone-600 leading-relaxed mt-2 flex-1">
              15 minuti al telefono: ci racconti il tuo locale e ti mostriamo dove SavoryMind
              troverebbe le prime perdite.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Richiesta demo SavoryMind")}&body=${encodeURIComponent(
                "Ciao, vorrei prenotare una demo di SavoryMind.\n\nNome del locale:\nCittà:\nNumero di telefono:\nFascia oraria preferita:"
              )}`}
              className="mt-6 block text-center bg-stone-900 hover:bg-stone-800 text-white font-bold px-5 py-3.5 rounded-2xl transition-colors"
            >
              Richiedi la demo
            </a>
          </div>
        </div>

        {/* Address + self-serve path */}
        <div className="mt-10 bg-stone-50 border border-stone-200 rounded-3xl px-7 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <p className="text-base text-stone-600">
            <span className="font-extrabold text-stone-900">SavoryMind</span> · Roma, Italia 🇮🇹
          </p>
          <p className="text-base text-stone-600">
            Preferisci fare da solo?{" "}
            <Link href={trialHref} className="font-bold text-brand-700 hover:text-brand-600">
              Inizia la prova gratuita di 30 giorni →
            </Link>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}

Contatti.bareLayout = true;
