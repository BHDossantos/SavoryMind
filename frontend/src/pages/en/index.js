/**
 * B2B homepage — English mirror of "/" (DEVELOPER_NOTES §3.2, EN hero).
 * Copy hardcoded in the JSX for full server-rendered HTML. Canonical
 * /en, hreflang pair with the Italian primary.
 */
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import MarketingShell, { signupHref } from "../../components/marketing/MarketingShell";
import CarlosCard, { DEMO_PLAN } from "../../components/marketing/CarlosCard";
import PricingTiers from "../../components/marketing/PricingTiers";
import { track } from "../../lib/analytics";

const STEPS = [
  {
    n: "1",
    title: "Connect your POS or upload a sales export",
    body:
      "A CSV or Excel file from any till works fine. No data at hand? Answer a 15-minute guided audit — your answers are enough to start.",
  },
  {
    n: "2",
    title: "SavoryMind finds the losses and quantifies them in euros",
    body:
      "Waste, over-portioning, staff downtime: every loss is identified, explained, and translated into a monthly figure you can verify yourself.",
  },
  {
    n: "3",
    title: "Your staff receives coaching plans on WhatsApp",
    body:
      "No new apps to install: each person gets concrete, respectful actions on the phone they already use. You approve everything before it goes out.",
  },
];

const MODULES = [
  {
    icon: "📊",
    title: "Dashboard",
    body: "Your estimated monthly loss and the money recovered to date — the first number you see every morning.",
  },
  {
    icon: "🗑️",
    title: "Losses & Waste",
    body: "Every kilo thrown away logged in 20 seconds from the kitchen, with euro cost and cause. Inventory included.",
  },
  {
    icon: "🎓",
    title: "Staff Coaching",
    body: "Personalized plans for every employee: what to improve, how, and what it's worth. Constructive, never punitive.",
  },
  {
    icon: "🍝",
    title: "Menu & Margins",
    body: "Which dishes actually earn and which cost you. Prices, portions, and trends at a glance.",
  },
  {
    icon: "🔮",
    title: "AI Predictions",
    body: "What you'll sell in the coming hours and days, before the rush — or the lull — arrives.",
  },
  {
    icon: "⚙️",
    title: "Settings & Billing",
    body: "Locations, employees, QR-code staff access, and billing: all your admin in one place.",
  },
];

const FAQS = [
  {
    q: "How much does food waste really cost a restaurant?",
    a: "Across the industry, food waste is worth 4–10% of food purchases. For a restaurant buying €10,000 of ingredients a month, that's €400–1,000 thrown away — before even counting over-portioning and staff downtime. SavoryMind calculates your real figure, in euros, and shows you where it comes from.",
  },
  {
    q: "Is it compatible with my POS or management system?",
    a: "Yes. You can upload a sales export as CSV or Excel from any system, or start with zero data through a 15-minute guided audit. Direct integrations with the POS systems most common in Italy are in development.",
  },
  {
    q: "Is my employees' data safe? (GDPR)",
    a: "Yes. SavoryMind is built for GDPR: every employee can request an export or deletion of their data, coaching plans are only sent on WhatsApp after explicit consent, and we send the AI only a name and work metrics — never personal contact details.",
  },
  {
    q: "Which languages does it work in?",
    a: "The interface is in Italian and English. Staff coaching plans can also be generated in Spanish — Rome's kitchens are multilingual, and we know it well.",
  },
  {
    q: "How does the guarantee work?",
    a: "You try SavoryMind free for 30 days. If by the end we haven't identified at least €500/month in recoverable losses, you pay nothing. And if your kitchen is already very efficient, we tell you honestly: no inflated numbers, ever.",
  },
  {
    q: "How long does it take to get started?",
    a: "About 15 minutes. Answer the guided audit questions (or upload a sales export) and you immediately see the first estimate of your monthly losses. No installation, no hardware, no consultants.",
  },
  {
    q: "Does my staff need to install an app?",
    a: "No. Staff receive their coaching plans directly on WhatsApp, the app they already use every day. The owner manages everything from the web dashboard, comfortably from a phone too.",
  },
  {
    q: "Can I cancel whenever I want?",
    a: "Yes, at any time from the billing section, with no penalties, effective at the end of the period. Your data remains exportable.",
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
        "SavoryMind finds the money restaurants lose — waste, portioning, staff time — and generates personalized coaching plans to stop it.",
      address: { "@type": "PostalAddress", addressLocality: "Rome", addressCountry: "IT" },
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

export default function HomeEN() {
  const router = useRouter();
  const trialHref = signupHref(router?.query, { type: "restaurant" });

  return (
    <MarketingShell lang="en" altHref="/">
      <Head>
        <title>SavoryMind — Find your restaurant&apos;s losses, in euros</title>
        <meta
          name="description"
          content="SavoryMind finds your restaurant's losses — waste, portioning, staff time — and generates coaching plans to stop them. Free 30-day trial."
        />
        <link rel="canonical" href="https://savorymind.net/en" />
        <link rel="alternate" hrefLang="it-IT" href="https://savorymind.net/" />
        <link rel="alternate" hrefLang="en-US" href="https://savorymind.net/en" />
        <link rel="alternate" hrefLang="x-default" href="https://savorymind.net/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SavoryMind" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://savorymind.net/en" />
        <meta property="og:title" content="Your restaurant is losing €500–2,000 a month. We show you where." />
        <meta
          property="og:description"
          content="Waste, portioning, staff time: SavoryMind finds them, quantifies them in euros, and generates coaching plans to stop them."
        />
        <meta property="og:image" content="https://savorymind.net/api/og/wedge" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SavoryMind — Find your restaurant's losses, in euros" />
        <meta
          name="twitter:description"
          content="Waste, portioning, staff time: SavoryMind finds them, quantifies them in euros, and generates coaching plans to stop them."
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
            <span aria-hidden="true">🇮🇹</span> For restaurants, trattorias, and pizzerias — Rome first
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-stone-900 leading-[1.12] tracking-tight max-w-4xl mx-auto">
            Your restaurant is losing €500–2,000 a month.{" "}
            <span className="text-brand-600">We show you where.</span>
          </h1>
          <p className="text-lg md:text-xl text-stone-600 leading-relaxed max-w-2xl mx-auto mt-6">
            SavoryMind analyzes waste, portioning, and staff time — then generates personalized
            coaching plans to stop the losses. See your first number in 15 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-9">
            <Link
              href={trialHref}
              onClick={() => track("marketing_cta_click", { page: "home_en", cta: "hero_trial" })}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white text-lg font-bold px-8 py-4 rounded-2xl shadow-lg shadow-brand-200 transition-colors"
            >
              Start your free 30-day trial
            </Link>
            <Link
              href="/come-funziona"
              onClick={() => track("marketing_cta_click", { page: "home_en", cta: "hero_demo" })}
              className="w-full sm:w-auto bg-white border-2 border-stone-300 hover:border-stone-400 text-stone-800 text-lg font-bold px-8 py-4 rounded-2xl transition-colors"
            >
              Watch the 3-minute demo
            </Link>
          </div>
          <p className="text-base font-semibold text-stone-500 mt-6">
            If we don&apos;t find at least €500/month in recoverable losses, you don&apos;t pay.
          </p>
        </div>
      </section>

      {/* ── The Carlos moment ────────────────────────────────────── */}
      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-4">The Carlos moment</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 leading-tight">
              Not &ldquo;waste is expensive.&rdquo; <br className="hidden md:block" />
              &ldquo;Carlos, Tuesday, €36.90.&rdquo;
            </h2>
            <p className="text-lg text-stone-600 leading-relaxed mt-5">
              POS systems tell you something is off. SavoryMind tells you <strong>who</strong>,{" "}
              <strong>how much</strong>, and <strong>why</strong> — then generates a concrete,
              respectful coaching plan for each person on your team. No blame, just processes to
              fix: the kitchen improves and people grow.
            </p>
            <ul className="mt-6 space-y-3 text-base text-stone-700">
              <li className="flex items-start gap-3">
                <span className="text-brand-600 font-black mt-0.5" aria-hidden="true">✓</span>
                Every waste incident logged in 20 seconds, during service
              </li>
              <li className="flex items-start gap-3">
                <span className="text-brand-600 font-black mt-0.5" aria-hidden="true">✓</span>
                Impact calculated in euros and kilos, never by gut feeling
              </li>
              <li className="flex items-start gap-3">
                <span className="text-brand-600 font-black mt-0.5" aria-hidden="true">✓</span>
                Plans approved by you before they reach the staff
              </li>
            </ul>
          </div>
          <CarlosCard plan={DEMO_PLAN} lang="en" />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">How it works</p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
            From the till to coaching in three steps
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
            Watch the 3-minute demo →
          </Link>
        </div>
      </section>

      {/* ── What's included ──────────────────────────────────────── */}
      <section className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">What&apos;s included</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="text-lg text-stone-600 mt-4 max-w-2xl mx-auto">
              Six clear modules, built for someone running a restaurant — not studying a software manual.
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
              <h3 className="text-lg font-extrabold mt-3">And much more included</h3>
              <p className="text-base text-brand-100 leading-relaxed mt-2 max-w-3xl">
                Bookings, customer CRM, review sentiment analysis, marketing tools, and more —
                already part of your plan, ready when you need them.
              </p>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link href="/ristoranti" className="text-base font-bold text-brand-700 hover:text-brand-600">
              Explore the product in detail →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">Pricing</p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
            A plan for every kitchen
          </h2>
          <p className="text-lg text-stone-600 mt-4">
            Less than what you lose to waste in a single week.
          </p>
        </div>
        <PricingTiers lang="en" />
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="bg-stone-50 border-y border-stone-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-16 md:py-24">
          <div className="text-center mb-10">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-600 mb-3">FAQ</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-stone-900">
              The questions every owner asks us
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
          Find out how much you&apos;re losing. <span className="text-brand-600">Today.</span>
        </h2>
        <p className="text-lg text-stone-600 mt-4">
          15 minutes to your first number. 30 days to verify it. Zero risk.
        </p>
        <Link
          href={trialHref}
          onClick={() => track("marketing_cta_click", { page: "home_en", cta: "footer_trial" })}
          className="inline-block mt-8 bg-brand-600 hover:bg-brand-700 text-white text-lg font-bold px-10 py-4 rounded-2xl shadow-lg shadow-brand-200 transition-colors"
        >
          Start your free 30-day trial
        </Link>
        <p className="text-base font-semibold text-stone-500 mt-5">
          If we don&apos;t find at least €500/month in recoverable losses, you don&apos;t pay.
        </p>

        <p className="mt-14 text-base text-stone-500">
          Love food?{" "}
          <Link href="/per-chi-ama-il-cibo" className="font-bold text-consumer-600 hover:text-consumer-700">
            Discover the app for people who eat →
          </Link>
        </p>
      </section>
    </MarketingShell>
  );
}

HomeEN.bareLayout = true;
