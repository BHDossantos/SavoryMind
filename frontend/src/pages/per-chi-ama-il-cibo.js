/**
 * /per-chi-ama-il-cibo — the consumer app landing (single page).
 * DEVELOPER_NOTES §3.1/§10: the ONLY consumer touch allowed. Keeps the
 * hero spirit of the old landing ("Tell us how you feel. We'll tell you
 * what to eat."), the two wedge doors, and the consumer signup CTA.
 * EN/IT mixed like the old landing; purple (consumer) palette — the
 * B2B/consumer visual separation stays consistent (§3.3).
 * Copy hardcoded in the JSX for crawlable HTML.
 */
import Head from "next/head";
import Link from "next/link";
import { track } from "../lib/analytics";

const FEATURES = [
  { icon: "🪄", title: "Mood-to-Meal", desc: "Dicci come ti senti — ti diciamo cosa mangiare. Tell us how you feel, we'll find your dish." },
  { icon: "📸", title: "Snap-a-Menu", desc: "Fotografa un menù che non capisci e l'AI sceglie per te. Order like a local, anywhere." },
  { icon: "🤖", title: "Ask Flavor", desc: "Il tuo assistente AI di cucina: abbinamenti, sostituzioni, tecniche." },
  { icon: "🍷", title: "Wine & Pairing", desc: "Il bicchiere giusto per quello che c'è nel piatto stasera." },
  { icon: "📅", title: "Scopri & Prenota", desc: "Trova il prossimo grande pasto fuori — per umore, cucina o budget." },
  { icon: "💎", title: "Il tuo profilo food", desc: "Più cucini e mangi, più SavoryMind impara cosa ami." },
];

export default function PerChiAmaIlCibo() {
  return (
    <div className="min-h-screen bg-white text-stone-900 antialiased">
      <Head>
        <title>SavoryMind per chi ama il cibo — Dimmi come ti senti</title>
        <meta
          name="description"
          content="Tell us how you feel. We'll tell you what to eat. L'app AI per chi ama cucinare e mangiare fuori: mood-to-meal, snap-a-menu, abbinamenti e prenotazioni."
        />
        <link rel="canonical" href="https://savorymind.net/per-chi-ama-il-cibo" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:url" content="https://savorymind.net/per-chi-ama-il-cibo" />
        <meta property="og:title" content="Tell us how you feel. We'll tell you what to eat." />
        <meta
          property="og:description"
          content="L'app AI per chi ama cucinare e mangiare fuori: mood-to-meal, snap-a-menu, abbinamenti e prenotazioni."
        />
        <meta property="og:image" content="https://savorymind.net/api/og/wedge" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://savorymind.net/api/og/wedge" />
      </Head>

      {/* Minimal header — consumer purple, with a way back to the B2B site */}
      <header className="border-b border-stone-100 sticky top-0 bg-white/95 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🧠</span>
            <span className="text-xl font-extrabold tracking-tight">
              Savory<span className="text-consumer-600">Mind</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[15px] font-medium text-stone-600 hover:text-stone-900">
              Accedi
            </Link>
            <Link
              href="/signup?type=consumer"
              className="bg-consumer-600 hover:bg-consumer-700 text-white text-[15px] font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              Crea il tuo profilo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — the old landing's North Star, kept alive here */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 pt-16 pb-14 md:pt-24 text-center">
        <p className="inline-flex items-center gap-2 bg-consumer-50 border border-consumer-200 text-consumer-700 text-sm font-bold px-4 py-1.5 rounded-full mb-7">
          <span aria-hidden="true">✨</span> L&rsquo;app per chi mangia
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-stone-900 max-w-3xl mx-auto">
          Tell us how you feel.{" "}
          <span className="bg-gradient-to-r from-consumer-600 via-consumer-500 to-diner-500 bg-clip-text text-transparent">
            We&rsquo;ll tell you what to eat.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-6">
          Dimmi come ti senti, e ti dico cosa mangiare. Un&rsquo;AI che conosce i tuoi gusti — per
          cucinare a casa o scegliere il posto giusto stasera. Provala subito, senza registrarti.
        </p>

        {/* Wedge doors — instant, no account required */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mt-10">
          <Link
            href="/discover/mood"
            onClick={() => track("landing_wedge_click", { target: "mood", page: "per-chi-ama-il-cibo" })}
            className="group bg-gradient-to-br from-consumer-600 to-consumer-800 text-white rounded-3xl p-6 text-left hover:shadow-xl hover:shadow-consumer-200 transition-all"
          >
            <span className="text-4xl block mb-3" aria-hidden="true">🪄</span>
            <h2 className="text-lg font-bold mb-1">Mood-to-Meal</h2>
            <p className="text-consumer-100 text-[15px] leading-relaxed mb-4">
              Dicci il tuo umore. Ti proponiamo il piatto giusto — da cucinare o da ordinare.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              Prova gratis <span className="group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
            </span>
          </Link>
          <Link
            href="/discover/menu"
            onClick={() => track("landing_wedge_click", { target: "menu", page: "per-chi-ama-il-cibo" })}
            className="group bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-3xl p-6 text-left hover:shadow-xl hover:shadow-amber-200 transition-all"
          >
            <span className="text-4xl block mb-3" aria-hidden="true">📸</span>
            <h2 className="text-lg font-bold mb-1">Snap-a-Menu</h2>
            <p className="text-amber-100 text-[15px] leading-relaxed mb-4">
              Un menù che non capisci? Fotografalo e l&rsquo;AI sceglie il piatto per te.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              Prova gratis <span className="group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
            </span>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gradient-to-br from-consumer-50 via-white to-diner-50 py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <h2 className="font-serif text-3xl font-bold text-stone-900 text-center mb-10">
            Tutto quello che ami del cibo, in un&rsquo;app
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-consumer-100 hover:border-consumer-300 hover:shadow-md transition-all">
                <span className="text-3xl block mb-3" aria-hidden="true">{f.icon}</span>
                <h3 className="font-extrabold text-stone-900 mb-2">{f.title}</h3>
                <p className="text-[15px] text-stone-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-16 md:py-20 text-center">
        <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 leading-tight">
          Il tuo profilo food ti aspetta.
        </h2>
        <p className="text-lg text-stone-600 mt-4">
          Gratis, in un minuto. Più lo usi, più ti conosce.
        </p>
        <Link
          href="/signup?type=consumer"
          onClick={() => track("marketing_cta_click", { page: "per-chi-ama-il-cibo", cta: "consumer_signup" })}
          className="inline-block mt-8 bg-consumer-600 hover:bg-consumer-700 text-white text-lg font-bold px-10 py-4 rounded-2xl shadow-lg shadow-consumer-200 transition-colors"
        >
          Crea il tuo profilo gratis
        </Link>
        <p className="mt-12 text-base text-stone-500">
          Hai un ristorante?{" "}
          <Link href="/" className="font-bold text-brand-600 hover:text-brand-700">
            Scopri SavoryMind per ristoranti →
          </Link>
        </p>
      </section>

      <footer className="border-t border-stone-100 py-8">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">🧠</span>
            <span className="font-bold text-stone-700">SavoryMind</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-stone-400">
            <Link href="/legal/privacy" className="hover:text-stone-600">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-stone-600">Termini</Link>
            <span>Made in Rome 🇮🇹</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

PerChiAmaIlCibo.bareLayout = true;
